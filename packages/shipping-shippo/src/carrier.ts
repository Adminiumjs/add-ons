/**
 * The Shippo transport: the server half, handed its key and an egress-bound
 * client by the engine, per operation.
 *
 * Every field name and status below was read from Shippo's real test-mode
 * answers on 2026-11-23 (API version 2018-02-08), unless its comment says the
 * answer comes from Shippo's documentation.
 *
 * THE THREE TRAPS, each proved against the test account:
 *  - The same rate bought twice makes two labels. Nothing here retries a
 *    purchase, and `recover` reports every label a rate produced.
 *  - A failed label is HTTP 201 with `status: ERROR`. Only `status` decides.
 *  - Test tracking numbers repeat, so nothing here keys on one.
 *
 * ONLY A CLEAR NO IS A REFUSAL. On a purchase, `outcome: 'refused'` means Shippo
 * said no label exists. A 5xx, a 429, a timeout or a status this file does not
 * know carries no outcome, which the engine reads as unknown and never rebuys.
 */

import {
  CarrierError,
  type Address,
  type BookingDetails,
  type CancelResult,
  type CancelState,
  type CarrierCredentialCheck,
  type CarrierRefusal,
  type CredentialCheckQuery,
  type CustomsContents,
  type CustomsDeclaration,
  type FileRef,
  type HandoverKind,
  type LabelSize,
  type OrderRef,
  type Parcel,
  type QuoteOptions,
  type Rate,
  type RecoveryResult,
  type Shipment,
  type ShipmentDocument,
  type ShipmentDocumentFile,
  type ShipmentDocumentKind,
  type ShippingCarrier,
  type ShippingCarrierContext,
  type ShippingHttpClient,
  type TrackEvent,
  type TrackOptions,
} from "@adminium/add-on-host/contracts";

import { ADD_ON_KEY } from "./add-on-key.ts";

export const WIRE = {
  apiHost: "api.goshippo.com",
  /** Where signed label files live. It never receives the key. */
  fileHost: "deliver.goshippo.com",
  apiVersion: "2018-02-08",
  testKeyPrefix: "shippo_test_",
  /** Shippo truncates a list asked for more than 200 rows (its documentation). */
  pageSize: 100,
  maxPages: 5,
  metadataWidth: 100,
} as const;

const API = `https://${WIRE.apiHost}`;

const LABEL_FILE_TYPES: Readonly<Record<LabelSize, string>> = {
  a4: "PDF_A4",
  a6: "PDF_A6",
  "4x6": "PDF_4x6",
};
const DEFAULT_LABEL_FILE_TYPE = LABEL_FILE_TYPES.a4;

/**
 * The carrier tokens the real test account lists. A service token starts with
 * its carrier's, which saves a rate-limited list call on every quote. A token
 * outside this list is asked about by its account id.
 */
const KNOWN_CARRIER_TOKENS = [
  "canada_post",
  "chronopost",
  "colissimo",
  "correos",
  "couriersplease",
  "deutsche_post",
  "dhl_express",
  "dpd_de",
  "dpd_uk",
  "fedex",
  "hermes_uk",
  "ups",
  "usps",
].sort((a, b) => b.length - a.length);

/**
 * Which sender countries each of Shippo's default accounts serves, from the
 * routes tried in test mode and Shippo's carrier page. A shop's OWN connected
 * account is always listed. **Whether a live shop outside the US gets these is
 * unconfirmed** until the owner's live walk.
 */
const DEFAULT_ACCOUNT_ORIGINS: Readonly<Record<string, readonly string[]>> = {
  canada_post: ["CA"],
  chronopost: ["FR"],
  colissimo: ["FR"],
  correos: ["ES"],
  couriersplease: ["AU"],
  deutsche_post: ["DE"],
  dhl_express: ["US"],
  dpd_de: ["DE"],
  dpd_uk: ["GB"],
  fedex: ["US"],
  hermes_uk: ["GB"],
  ups: ["US"],
  usps: ["US"],
};

/** Shippo still calls Evri by its old name. A shop looks for the name on the van. */
const CARRIER_NAMES: Readonly<Record<string, string>> = { "Hermes UK": "Evri" };
const carrierName = (name: string): string => CARRIER_NAMES[name] ?? name;

/** What each account says about itself when a shipment is rated, and is not about this parcel. */
const NOISE = /doesn't support one or more|too many requests|master account|out of service area/i;
const ADDRESS_WORDS = /address|postal|postcode|zip|street|city|state|recipient|destination/i;
/** A letter outside the Latin script. Marks, digits and punctuation are in every script. */
const NON_LATIN = /(?!\p{Script=Latin})\p{L}/u;
/** A label that can be used. A rejected refund leaves it paid for and valid. */
const LIVE_LABEL: ReadonlySet<string> = new Set(["SUCCESS", "REFUNDREJECTED"]);
/** Every status with a final answer. Anything else may still become a label. */
const SETTLED_LABEL: ReadonlySet<string> = new Set([...LIVE_LABEL, "ERROR", "REFUNDED"]);
const MAX_LOOKUP_RATES = 20;
const DECIMAL = /^\d+(\.\d+)?$/;
const HTTPS_URL = /^https:\/\/\S+$/;

type Wire = Record<string, unknown>;

interface Reply {
  status: number;
  json: unknown;
}

const isRecord = (value: unknown): value is Wire => typeof value === "object" && value !== null && !Array.isArray(value);
const records = (value: unknown): Wire[] => (Array.isArray(value) ? value.filter(isRecord) : []);
const textOf = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
const isOk = (status: number): boolean => status >= 200 && status < 300;

/** Shippo's own words, wherever this kind of answer keeps them. */
function saidIn(json: unknown): string | undefined {
  if (!isRecord(json)) return undefined;
  const messages = records(json.messages)
    .map((message) => textOf(message.text))
    .filter((text): text is string => text !== undefined);
  const useful = messages.find((text) => !NOISE.test(text));
  if (useful !== undefined) return useful;
  const detail = textOf(json.detail);
  if (detail !== undefined) return detail;
  for (const value of Object.values(json)) {
    if (Array.isArray(value)) {
      const first = value.map(textOf).find((text) => text !== undefined);
      if (first !== undefined) return first;
    }
  }
  return undefined;
}

function reasonOf(text: string): CarrierRefusal {
  if (/customs|commercial invoice|hs code|harmoni[sz]ed/i.test(text)) return "customs";
  if (/login|password|regist|terms and conditions|credential|token|not authori[sz]ed|api key/i.test(text)) return "credentials";
  if (/payment|billing|credit card|insufficient|balance/i.test(text)) return "payment";
  if (/expired|rate with supplied/i.test(text)) return "rate-expired";
  if (ADDRESS_WORDS.test(text)) return "address";
  return "unavailable";
}

const refused = (code: string, carrierMessage: string, reason: CarrierRefusal): CarrierError =>
  new CarrierError({ code, carrierMessage, outcome: "refused", reason, retryable: reason !== "credentials" });

/** No outcome on purpose: on a purchase this reads as unknown. */
const noClearAnswer = (code: string, carrierMessage: string): CarrierError =>
  new CarrierError({ code, carrierMessage, retryable: false });

const unreachable = (): CarrierError => noClearAnswer("shippo_unreachable", "Shippo did not answer.");

function httpFailure(reply: Reply, fallback: string): CarrierError {
  const said = saidIn(reply.json) ?? fallback;
  if (reply.status === 429) return new CarrierError({ code: "shippo_rate_limited", carrierMessage: said, retryable: true });
  if (reply.status === 401 || reply.status === 403) return refused(`shippo_${reply.status}`, said, "credentials");
  return noClearAnswer(`shippo_${reply.status}`, said);
}

/** Why a purchase failed. Only a structured 4xx proves nothing was bought. */
function bookFailure(reply: Reply): CarrierError {
  const said = saidIn(reply.json);
  if (reply.status === 401 || reply.status === 403) return refused(`shippo_${reply.status}`, said ?? "Shippo did not accept this key.", "credentials");
  if (reply.status === 402) return refused("shippo_402", said ?? "Shippo could not charge this account.", "payment");
  if ((reply.status === 400 || reply.status === 422) && isRecord(reply.json) && said !== undefined) {
    return refused(`shippo_${reply.status}`, said, reasonOf(said));
  }
  return noClearAnswer(`shippo_${reply.status}`, said ?? "Shippo did not say whether this label was bought.");
}

function hasNonLatin(address: Address | undefined): boolean {
  if (address === undefined) return false;
  return [address.name, address.company ?? "", address.city, ...address.lines].some((part) => NON_LATIN.test(part));
}

/** A label Shippo failed. In test mode USPS refused an Arabic street this way, with no words at all. */
function failedLabel(tx: Wire, details: BookingDetails | undefined): CarrierError {
  const said = saidIn(tx);
  if (said !== undefined) return refused("shippo_label_error", said, reasonOf(said));
  if (hasNonLatin(details?.to) || hasNonLatin(details?.from)) {
    return refused("shippo_label_error", "The carrier could not make a label for this address. It may need the address in Latin letters.", "address");
  }
  return refused("shippo_label_error", "The carrier could not make this label and gave no reason.", "unavailable");
}

/**
 * One address on the wire. `contact` is false for the customer's side: USPS,
 * Evri and DPD UK all issued test labels with no recipient phone or e-mail, so
 * neither leaves this server inside one country. A parcel going abroad is the
 * one case that sends the phone.
 */
function wireAddress(address: Address, contact: boolean): Wire {
  const [street1, street2, ...rest] = address.lines;
  return {
    name: address.name,
    ...(address.company === undefined ? {} : { company: address.company }),
    street1,
    ...(street2 === undefined ? {} : { street2 }),
    ...(rest.length === 0 ? {} : { street3: rest.join(", ") }),
    city: address.city,
    ...(address.region === undefined ? {} : { state: address.region }),
    zip: address.postcode,
    country: address.country.toUpperCase(),
    ...(contact && address.phone !== undefined ? { phone: address.phone } : {}),
    ...(contact && address.email !== undefined ? { email: address.email } : {}),
  };
}

const CONTENTS_TYPES: Readonly<Record<CustomsContents, string>> = {
  merchandise: "MERCHANDISE",
  gift: "GIFT",
  sample: "SAMPLE",
  documents: "DOCUMENTS",
  return: "RETURN_MERCHANDISE",
  other: "OTHER",
};

/** The longest code Shippo takes as a tariff number. A longer one goes in its HS field. */
const TARIFF_WIDTH = 12;

/** `quantity × unit` as an exact decimal: a customs value is never rounded through a float. */
export function lineValue(unit: string, quantity: number): string {
  const [whole = "0", fraction = ""] = unit.split(".");
  const digits = (BigInt(`${whole}${fraction}`) * BigInt(quantity)).toString().padStart(fraction.length + 1, "0");
  if (fraction.length === 0) return digits;
  const point = digits.length - fraction.length;
  return `${digits.slice(0, point)}.${digits.slice(point)}`;
}

/**
 * The declaration on the wire. Shippo's item takes the LINE's total value and
 * total weight, where the contract holds one unit's.
 *
 * Duties are left to the recipient (`DDU`), which is what the shop's checkout
 * tells them. Whether every carrier accepts that term is on the live walk.
 */
function wireCustoms(customs: CustomsDeclaration): Wire {
  return {
    contents_type: CONTENTS_TYPES[customs.contents],
    ...(customs.contents === "other" ? { contents_explanation: customs.items[0]!.description.slice(0, 200) } : {}),
    non_delivery_option: customs.nonDelivery === "abandon" ? "ABANDON" : "RETURN",
    certify: true,
    certify_signer: customs.signer,
    incoterm: "DDU",
    items: customs.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      net_weight: String(Number((item.unitWeightKg * item.quantity).toFixed(6))),
      mass_unit: "kg",
      value_amount: lineValue(item.unitValue, item.quantity),
      value_currency: item.currency.toUpperCase(),
      origin_country: item.originCountry,
      ...(item.hsCode === undefined ? {} : item.hsCode.length <= TARIFF_WIDTH ? { tariff_number: item.hsCode } : { hs_code: item.hsCode }),
      ...(item.skuCode === undefined ? {} : { sku_code: item.skuCode }),
      ...(item.manufacturerCode === undefined ? {} : { manufacturer_code: item.manufacturerCode }),
    })),
  };
}

/**
 * Only what a service's own name says. Evri's ParcelShop services are the one
 * case the real answers settle. USPS, UPS and DPD can each be dropped off or
 * collected depending on the shop's arrangement, so they stay `unknown`, and
 * Shippo booking a label never books a van.
 */
function handoverOf(token: string): HandoverKind {
  if (/drop_?off|parcelshop|locker/i.test(token)) return "drop-off";
  if (/courier_collection|collection|pickup/i.test(token)) return "carrier-collects";
  return "unknown";
}

function carrierTokenOf(serviceToken: string): string | undefined {
  return KNOWN_CARRIER_TOKENS.find((token) => serviceToken === token || serviceToken.startsWith(`${token}_`));
}

/** One rate, or null for a row that cannot be priced honestly. */
function rateFrom(row: Wire, carrierToken?: string): Rate | null {
  const ref = textOf(row.object_id);
  const amountDecimal = textOf(row.amount);
  const currency = textOf(row.currency);
  const level = isRecord(row.servicelevel) ? row.servicelevel : {};
  const code = textOf(level.token);
  if (ref === undefined || amountDecimal === undefined || !DECIMAL.test(amountDecimal) || currency === undefined || currency.length !== 3 || code === undefined) {
    return null;
  }
  const days = row.estimated_days;
  const provider = textOf(row.provider);
  const token = carrierToken ?? carrierTokenOf(code);
  return {
    code,
    service: textOf(level.name) ?? code,
    amount: Number(amountDecimal),
    amountDecimal,
    currency: currency.toUpperCase(),
    ...(typeof days === "number" && Number.isInteger(days) && days >= 0 ? { estimatedDays: days } : {}),
    ref,
    ...(provider === undefined ? {} : { carrier: carrierName(provider) }),
    ...(token === undefined ? {} : { carrierToken: token }),
    handover: handoverOf(code),
  };
}

function shipmentFrom(tx: Wire, rate: Rate): Shipment | null {
  const id = textOf(tx.object_id);
  const tracking = textOf(tx.tracking_number);
  if (id === undefined || tracking === undefined) return null;
  const trackingUrl = textOf(tx.tracking_url_provider);
  const documents: ShipmentDocument[] = [{ kind: "label", mediaType: "application/pdf" }];
  if (textOf(tx.commercial_invoice_url) !== undefined) documents.push({ kind: "customs-invoice", mediaType: "application/pdf" });
  return {
    id,
    tracking,
    // A signed address is never stored: the file is fetched by the transaction's id.
    labelFileId: id,
    rate,
    ...(rate.carrier === undefined ? {} : { carrier: rate.carrier }),
    ...(rate.carrierToken === undefined ? {} : { carrierToken: rate.carrierToken }),
    ...(trackingUrl !== undefined && HTTPS_URL.test(trackingUrl) ? { trackingUrl } : {}),
    test: tx.test === true,
    documents,
  };
}

const rateIdOf = (tx: Wire): string | undefined => textOf(tx.rate) ?? (isRecord(tx.rate) ? textOf(tx.rate.object_id) : undefined);

function eventFrom(row: Wire): TrackEvent | null {
  const at = textOf(row.status_date);
  const status = textOf(row.status);
  if (at === undefined || status === undefined) return null;
  const location = isRecord(row.location) ? row.location : {};
  const place = [textOf(location.city), textOf(location.state), textOf(location.country)].filter((part) => part !== undefined).join(", ");
  return { at, ...(place === "" ? {} : { place }), status, description: textOf(row.status_details) ?? status };
}

/** A refund's own status. `QUEUED` and `PENDING` are from Shippo's documentation, the other two were seen. */
function refundState(status: string | undefined): CancelState {
  if (status === "SUCCESS") return "refunded";
  if (status === "ERROR") return "refused";
  if (status === "PENDING") return "pending";
  return "requested";
}

/** What a transaction's status says about its refund, or null if it says nothing. */
function refundStateOfLabel(status: string | undefined): CancelState | null {
  if (status === "REFUNDED") return "refunded";
  if (status === "REFUNDPENDING") return "pending";
  if (status === "REFUNDREJECTED") return "refused";
  return null;
}

export interface ShippoCarrierOptions {
  /** Built by the engine and bound to this add-on's `network.allow`. */
  http: ShippingHttpClient;
  apiKey: string;
  signal?: AbortSignal;
}

export function createShippoCarrier({ http, apiKey, signal }: ShippoCarrierOptions): ShippingCarrier {
  const withSignal = signal === undefined ? {} : { signal };

  async function call(method: "GET" | "POST", path: string, body?: unknown): Promise<Reply> {
    try {
      const response = await http(`${API}${path}`, {
        method,
        headers: {
          authorization: `ShippoToken ${apiKey}`,
          "shippo-api-version": WIRE.apiVersion,
          accept: "application/json",
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        ...withSignal,
      });
      const text = await response.text();
      let json: unknown;
      try {
        json = text === "" ? undefined : JSON.parse(text);
      } catch {
        json = undefined;
      }
      return { status: response.status, json };
    } catch {
      // The client's own error can hold the address it was asked for.
      throw unreachable();
    }
  }

  /** The next page's path, only if Shippo's link stays on its own API. */
  function nextPath(value: unknown): string | null {
    const next = textOf(value);
    if (next === undefined) return null;
    try {
      const url = new URL(next);
      return url.protocol === "https:" && url.hostname === WIRE.apiHost ? `${url.pathname}${url.search}` : null;
    } catch {
      return null;
    }
  }

  /** `complete` is false when Shippo had more rows than were read, so an absence proves nothing. */
  async function list(firstPath: string, fallback: string): Promise<{ rows: Wire[]; complete: boolean }> {
    const rows: Wire[] = [];
    let path: string | null = firstPath;
    let complete = false;
    for (let page = 0; path !== null && page < WIRE.maxPages; page += 1) {
      const reply: Reply = await call("GET", path);
      if (reply.status !== 200 || !isRecord(reply.json) || !Array.isArray(reply.json.results)) throw httpFailure(reply, fallback);
      rows.push(...records(reply.json.results));
      complete = textOf(reply.json.next) === undefined;
      path = nextPath(reply.json.next);
    }
    return { rows, complete };
  }

  async function transaction(shipmentId: string): Promise<Wire> {
    const reply = await call("GET", `/transactions/${encodeURIComponent(shipmentId)}`);
    if (reply.status !== 200 || !isRecord(reply.json)) throw httpFailure(reply, "Shippo could not find this label.");
    return reply.json;
  }

  /** Fills in carrier tokens the service token could not name. Best effort: without one, a parcel shows its number alone. */
  async function tokensFor(rows: Wire[]): Promise<Map<string, string>> {
    const unknown = new Set<string>();
    for (const row of rows) {
      const level = isRecord(row.servicelevel) ? row.servicelevel : {};
      const code = textOf(level.token);
      const account = textOf(row.carrier_account);
      if (code !== undefined && account !== undefined && carrierTokenOf(code) === undefined) unknown.add(account);
    }
    const tokens = new Map<string, string>();
    for (const account of [...unknown].slice(0, 5)) {
      const reply = await call("GET", `/carrier_accounts/${encodeURIComponent(account)}`).catch(() => null);
      const token = reply !== null && reply.status === 200 && isRecord(reply.json) ? textOf(reply.json.carrier) : undefined;
      if (token !== undefined) tokens.set(account, token);
    }
    return tokens;
  }

  async function rateById(ref: string): Promise<Rate> {
    const reply = await call("GET", `/rates/${encodeURIComponent(ref)}`);
    if (reply.status !== 200 || !isRecord(reply.json)) throw httpFailure(reply, "Shippo could not read this rate.");
    const tokens = await tokensFor([reply.json]);
    const account = textOf(reply.json.carrier_account);
    const rate = rateFrom(reply.json, account === undefined ? undefined : tokens.get(account));
    if (rate === null) throw noClearAnswer("shippo_bad_rate", "Shippo answered with a rate Adminium cannot read.");
    return rate;
  }

  async function fetchDocument(shipmentId: string, kind: ShipmentDocumentKind): Promise<ShipmentDocumentFile> {
    const tx = await transaction(shipmentId);
    const address = textOf(kind === "label" ? tx.label_url : tx.commercial_invoice_url);
    if (address === undefined) throw noClearAnswer("shippo_no_file", "Shippo holds no such file for this label.");
    let url: URL;
    try {
      url = new URL(address);
    } catch {
      throw noClearAnswer("shippo_bad_file_address", "Shippo gave a file address Adminium cannot use.");
    }
    if (url.protocol !== "https:" || url.hostname !== WIRE.fileHost) {
      throw noClearAnswer("shippo_bad_file_address", "Shippo gave a file address Adminium cannot use.");
    }
    let bytes: Uint8Array;
    let mediaType: string;
    try {
      // No key and no other header: a signed address is its own permission.
      const response = await http(url.toString(), { method: "GET", headers: { accept: "application/pdf" }, ...withSignal });
      if (response.status !== 200) throw new Error("no file");
      bytes = new Uint8Array(await response.arrayBuffer());
      mediaType = (response.headers.get("content-type") ?? "application/pdf").split(";")[0]!.trim();
    } catch {
      throw noClearAnswer("shippo_file_failed", "The label file could not be fetched.");
    }
    return { kind, mediaType, bytes };
  }

  async function requestCancel(shipmentId: string): Promise<CancelResult> {
    const reply = await call("POST", "/refunds/", { transaction: shipmentId, async: false });
    if (isOk(reply.status) && isRecord(reply.json)) {
      const reference = textOf(reply.json.object_id);
      const state = refundState(textOf(reply.json.status));
      const said = state === "refused" ? saidIn(reply.json) : undefined;
      return { state, ...(reference === undefined ? {} : { reference }), ...(said === undefined ? {} : { carrierMessage: said }) };
    }
    if (reply.status === 400) {
      // Shippo answers 400 to a second request, so the label says where the first one got to.
      const known = refundStateOfLabel(textOf((await transaction(shipmentId)).status));
      if (known !== null) return { state: known };
      // The label can still read SUCCESS while an earlier request waits in Shippo's queue.
      const { rows, complete } = await list(`/refunds/?results=${WIRE.pageSize}`, "Shippo could not list its refunds.");
      const earlier = rows.find((row) => row.transaction === shipmentId);
      if (earlier !== undefined) {
        const state = refundState(textOf(earlier.status));
        const reference = textOf(earlier.object_id);
        if (state !== "refused") return { state, ...(reference === undefined ? {} : { reference }) };
      } else if (!complete) {
        throw noClearAnswer("shippo_refund_unclear", "Shippo did not say whether this label already has a refund request.");
      }
      const said = saidIn(reply.json);
      return { state: "refused", ...(said === undefined ? {} : { carrierMessage: said }) };
    }
    throw httpFailure(reply, "Shippo did not answer this refund request.");
  }

  /**
   * Makes the declaration a shipment will name. A plain error reads as "could
   * not be reached", and a clear no from Shippo is about the customs details.
   */
  async function declare(customs: CustomsDeclaration): Promise<string> {
    if (customs.certified !== true || customs.items.length === 0) {
      throw refused("shippo_customs_incomplete", "This customs declaration is not complete.", "customs");
    }
    let reply: Reply;
    try {
      reply = await call("POST", "/customs/declarations/", wireCustoms(customs));
    } catch {
      throw new Error("Shippo did not answer.");
    }
    if (reply.status >= 500 || reply.status === 429) throw new Error("Shippo did not answer.");
    if (!isOk(reply.status) || !isRecord(reply.json) || textOf(reply.json.object_state) === "INVALID") {
      const said = saidIn(reply.json) ?? "Shippo refused this customs declaration.";
      throw refused(`shippo_${reply.status}`, said, reply.status === 401 || reply.status === 403 ? "credentials" : "customs");
    }
    const id = textOf(reply.json.object_id);
    if (id === undefined) throw new Error("Shippo did not answer.");
    return id;
  }

  return {
    key: ADD_ON_KEY,

    async quote(parcel: Parcel, from: Address, to: Address, options?: QuoteOptions): Promise<Rate[]> {
      const declaration = options?.customs === undefined ? undefined : await declare(options.customs);
      const customerIsSender = options?.purpose === "return";
      const { email: _email, ...toWithoutEmail } = to;
      let reply: Reply;
      try {
        reply = await call("POST", "/shipments/", {
          address_from: wireAddress(from, !customerIsSender),
          // A parcel crossing a border needs the recipient's number, and never their e-mail.
          address_to: declaration !== undefined && !customerIsSender ? wireAddress(toWithoutEmail, true) : wireAddress(to, customerIsSender),
          ...(declaration === undefined ? {} : { customs_declaration: declaration }),
          parcels: [
            {
              length: String(parcel.lengthCm),
              width: String(parcel.widthCm),
              height: String(parcel.heightCm),
              distance_unit: "cm",
              weight: String(parcel.weightKg),
              mass_unit: "kg",
            },
          ],
          async: false,
        });
      } catch {
        // A plain error reads as "could not be reached", which is the truth here.
        throw new Error("Shippo did not answer.");
      }
      if (reply.status >= 500 || reply.status === 429) throw new Error("Shippo did not answer.");
      if (!isOk(reply.status) || !isRecord(reply.json)) {
        const said = saidIn(reply.json) ?? "Shippo refused to rate this parcel.";
        throw refused(`shippo_${reply.status}`, said, reply.status === 401 || reply.status === 403 ? "credentials" : reasonOf(said));
      }
      const rows = records(reply.json.rates);
      const tokens = await tokensFor(rows);
      const rates = rows
        .map((row) => {
          const account = textOf(row.carrier_account);
          return rateFrom(row, account === undefined ? undefined : tokens.get(account));
        })
        .filter((rate): rate is Rate => rate !== null)
        .sort((a, b) => a.amount - b.amount || a.code.localeCompare(b.code))
        .slice(0, 100);
      if (rates.length === 0) {
        const messages = records(reply.json.messages)
          .map((message) => textOf(message.text))
          .filter((text): text is string => text !== undefined && !NOISE.test(text));
        const said = messages.find((text) => ADDRESS_WORDS.test(text)) ?? messages[0];
        throw refused(
          "NO_SERVICES",
          said ?? "No services are available for this parcel and address.",
          said !== undefined && ADDRESS_WORDS.test(said) ? "address" : "unavailable",
        );
      }
      return rates;
    },

    async book(rate: Rate, order: OrderRef, details?: BookingDetails): Promise<Shipment> {
      if (rate.ref === undefined) throw refused("shippo_no_rate", "This rate cannot be bought. Get rates again.", "rate-expired");
      const reply = await call("POST", "/transactions/", {
        rate: rate.ref,
        label_file_type: details?.labelSize === undefined ? DEFAULT_LABEL_FILE_TYPE : LABEL_FILE_TYPES[details.labelSize],
        async: false,
        metadata: order.reference.slice(0, WIRE.metadataWidth),
      });
      if (!isOk(reply.status)) throw bookFailure(reply);
      if (!isRecord(reply.json)) throw noClearAnswer("shippo_bad_answer", "Shippo did not say whether this label was bought.");
      const status = textOf(reply.json.status);
      if (status === "ERROR") throw failedLabel(reply.json, details);
      if (status !== "SUCCESS") throw noClearAnswer(`shippo_status_${status ?? "none"}`, "Shippo has not finished this label yet.");
      const shipment = shipmentFrom(reply.json, rate);
      if (shipment === null) throw noClearAnswer("shippo_no_tracking", "Shippo reported a label with no tracking number.");
      return shipment;
    },

    async track(tracking: string, options?: TrackOptions): Promise<TrackEvent[]> {
      const token = options?.carrierToken;
      if (token === undefined) return [];
      const reply = await call("GET", `/tracks/${encodeURIComponent(token)}/${encodeURIComponent(tracking)}`);
      if (reply.status === 404) return [];
      // A test key can only track Shippo's sample numbers, and says so with a 400.
      if (reply.status === 400 && /test tracking carrier/i.test(saidIn(reply.json) ?? "")) return [];
      if (!isOk(reply.status) || !isRecord(reply.json)) throw httpFailure(reply, "Shippo could not be asked about this parcel.");
      const history = records(reply.json.tracking_history);
      const current = isRecord(reply.json.tracking_status) ? reply.json.tracking_status : null;
      const rows = current !== null && !history.some((row) => row.object_id === current.object_id) ? [...history, current] : history;
      return rows
        .map(eventFrom)
        .filter((event): event is TrackEvent => event !== null)
        .slice(-500);
    },

    async label(shipmentId: string): Promise<FileRef> {
      const file = await fetchDocument(shipmentId, "label");
      return { fileId: shipmentId, filename: `shippo-label-${shipmentId}.pdf`, mediaType: file.mediaType, bytes: file.bytes.byteLength };
    },

    fetchDocument,

    async cancel(shipmentId: string): Promise<void> {
      const result = await requestCancel(shipmentId);
      if (result.state === "refused") {
        throw refused("shippo_refund_refused", result.carrierMessage ?? "Shippo refused this refund.", "unavailable");
      }
    },

    requestCancel,

    async cancelStatus(shipmentId: string): Promise<CancelResult> {
      const status = textOf((await transaction(shipmentId)).status);
      return { state: refundStateOfLabel(status) ?? "requested" };
    },

    async checkCredentials(query?: CredentialCheckQuery): Promise<CarrierCredentialCheck> {
      let rows: Wire[];
      try {
        ({ rows } = await list(`/carrier_accounts/?results=${WIRE.pageSize}`, "Shippo did not answer."));
      } catch (error) {
        if (error instanceof CarrierError && error.reason === "credentials") {
          return { outcome: "refused", carrierMessage: error.carrierMessage };
        }
        return { outcome: "unreachable" };
      }
      // Test only when the key and every answer agree. Wrongly calling a live key "test" would hide a paid label.
      const mode = apiKey.startsWith(WIRE.testKeyPrefix) && rows.every((row) => row.test === true) ? "test" : "live";
      const country = query?.country?.toUpperCase();
      const names = rows
        .filter((row) => row.active === true)
        .filter((row) => {
          if (country === undefined || row.is_shippo_account !== true) return true;
          const carrier = textOf(row.carrier);
          return carrier !== undefined && (DEFAULT_ACCOUNT_ORIGINS[carrier] ?? []).includes(country);
        })
        .map((row) => textOf(row.carrier_name) ?? textOf(row.carrier))
        .filter((name): name is string => name !== undefined)
        .map(carrierName);
      const owner = rows.map((row) => textOf(row.object_owner)).find((value) => value !== undefined);
      return {
        outcome: "ok",
        mode,
        // Goes straight into the engine's keyed hash, and is stored and shown nowhere as it is.
        ...(owner === undefined ? {} : { accountFingerprint: owner }),
        carriers: [...new Set(names)],
      };
    },

    /**
     * Looks a purchase up by the rates it may have been bought at. Shippo's
     * filter is not documented, so every row's own rate is checked as well.
     */
    async recover(order: OrderRef): Promise<RecoveryResult> {
      const refs = [...new Set(order.rateRefs ?? [])];
      if (refs.length === 0) return { outcome: "no-match" };
      // Dropping a rate could miss its label, and the engine buys again on anything but "found".
      if (refs.length > MAX_LOOKUP_RATES) throw noClearAnswer("shippo_too_many_rates", "Too many earlier attempts to look up.");
      const rows: { ref: string; tx: Wire }[] = [];
      let everyRateAnswered = true;
      for (const ref of refs) {
        const page = await list(`/transactions/?rate=${encodeURIComponent(ref)}&results=${WIRE.pageSize}`, "Shippo could not look this purchase up.");
        if (!page.complete) throw noClearAnswer("shippo_list_cut_off", "Shippo has more labels than could be read.");
        const found = page.rows.filter((tx) => rateIdOf(tx) === ref);
        if (found.length === 0) everyRateAnswered = false;
        rows.push(...found.map((tx) => ({ ref, tx })));
      }
      const hasNumber = (tx: Wire) => textOf(tx.tracking_number) !== undefined;
      const bought = rows
        .filter(({ tx }) => LIVE_LABEL.has(textOf(tx.status) ?? ""))
        .sort((a, b) => String(a.tx.object_created ?? "").localeCompare(String(b.tx.object_created ?? "")) || String(a.tx.object_id).localeCompare(String(b.tx.object_id)));
      if (bought.length > 0) {
        const ordered = [...bought.filter(({ tx }) => hasNumber(tx)), ...bought.filter(({ tx }) => !hasNumber(tx))];
        // Nothing the contract can record, and it is paid for: stop a rebuy until a person refunds it in Shippo.
        if (!hasNumber(ordered[0]!.tx)) throw noClearAnswer("shippo_no_tracking", "Shippo holds a paid label with no tracking number.");
        const rates = new Map<string, Rate>();
        const shipments: Shipment[] = [];
        for (const { ref, tx } of ordered.slice(0, 51)) {
          if (!rates.has(ref)) rates.set(ref, await rateById(ref));
          // A duplicate is only counted, so one with no number still counts as a label to refund.
          const shipment = shipmentFrom(hasNumber(tx) ? tx : { ...tx, tracking_number: tx.object_id }, rates.get(ref)!);
          if (shipment === null) throw noClearAnswer("shippo_bad_answer", "Shippo answered with a label Adminium cannot read.");
          shipments.push(shipment);
        }
        const [shipment, ...duplicates] = shipments;
        return { outcome: "found", shipment: shipment!, ...(duplicates.length === 0 ? {} : { duplicates }) };
      }
      // A label still being made or refunded may yet stand, and "no-match" would let the engine buy over it.
      if (rows.some(({ tx }) => !SETTLED_LABEL.has(textOf(tx.status) ?? ""))) {
        throw noClearAnswer("shippo_purchase_unsettled", "Shippo has not finished this purchase yet.");
      }
      // Not bought only when every rate has an answer and every answer is a failed label.
      if (everyRateAnswered && rows.every(({ tx }) => textOf(tx.status) === "ERROR")) {
        const said = saidIn(rows[0]!.tx);
        return { outcome: "not-bought", ...(said === undefined ? {} : { carrierMessage: said }) };
      }
      // Refunded, or nothing yet: neither proves this order was never bought.
      return { outcome: "no-match" };
    },
  };
}

/** The factory the engine loads, by this exact name. */
export function createShippingCarrier(context: ShippingCarrierContext): ShippingCarrier {
  return createShippoCarrier({
    http: context.http,
    apiKey: context.credentials.api_key ?? "",
    ...(context.signal === undefined ? {} : { signal: context.signal }),
  });
}
