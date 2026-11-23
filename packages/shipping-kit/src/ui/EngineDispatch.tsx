/**
 * THE REAL BOOKING FLOW, on the engine's routes (T12a, states S08–S26).
 *
 * THE ENGINE IS THE ONLY RECORD. This screen remembers nothing about a purchase
 * that it did not just read: on every load, and after every purchase that did
 * not end in a clear answer, it asks `bookings()` what is true. What it draws
 * follows from that one answer:
 *
 *   a booked parcel        its label card
 *   a purchase unanswered  the unknown card, and no Book anywhere
 *   a purchase under way   a wait card, and no Book anywhere
 *   nothing, and bookable  the parcel form, rates and Book
 *   nothing, not bookable  a card saying why
 *
 * BOOK IS DRAWN ONLY ON A POSITIVE "NO BOOKING". There is no path from a bought
 * or unknown parcel back to a live Book for that parcel: "Add another parcel"
 * opens a NEW parcel number, with its own read of `bookable`.
 *
 * THE HOST IS NOT TOLD OF A BOOKING. `onBooked` is the demo's hand-off, and a
 * host may move its order on it. Buying a real label moves no order (D4): the
 * engine records the number, and the order moves when staff press "Handed over".
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { CircleCheck, CircleSlash, CircleX, LoaderCircle, Lock, Plus, RefreshCw, Truck } from "lucide-react";
import type { DispatchPayload } from "@adminium/add-on-host";
import type { HandoverKind } from "@adminium/add-on-host/contracts";
import type { EngineAccess, EngineBooking, EngineBookings, EngineCarrier, EngineLookUpOutcome } from "@adminium/add-on-host/engine-carrier";

import { useT } from "../i18n/t.ts";
import { NotAffiliated } from "./atoms.tsx";
import { holderOf, holdersIn, latestOf, nextParcel, outboundIn, type EngineRate } from "./engine/flow.ts";
import { LabelCard } from "./engine/LabelCard.tsx";
import { AddressBlock, ParcelBooking } from "./engine/ParcelBooking.tsx";
import { FlowButton, LiveRegion, StatusCard, TestBanner, useSay } from "./engine/parts.tsx";
import { UnknownCard } from "./engine/UnknownCard.tsx";

/** What a purchase with no clear answer turned out to be, once the list was read. */
type Aftermath = "checking" | "found" | "safe" | "no-record" | "read-failed" | null;

export function EngineDispatch({
  client,
  access,
  payload,
  source,
}: {
  client: EngineCarrier;
  access: EngineAccess;
  payload: DispatchPayload;
  source: { table: string; id: string };
}) {
  const t = useT();
  const { order, chosen } = payload;
  const { said, say } = useSay();
  const mode = access.mode ?? "live";
  const test = mode === "test";

  const [all, setAll] = useState<EngineBooking[]>([]);
  const [slot, setSlot] = useState<Pick<EngineBookings, "bookable" | "blockedBy"> | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [parcelNumber, setParcelNumber] = useState(1);
  const [adding, setAdding] = useState(false);
  const [opened, setOpened] = useState(false);
  const [aftermath, setAftermath] = useState<Aftermath>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  /** How each service leaves, as the rate said. A booking does not record it, so it lasts as long as this page. */
  const handovers = useRef(new Map<string, HandoverKind>());
  /** The one read whose answer still counts: a slower, older reply must not overwrite a newer one. */
  const readCount = useRef(0);

  const read = useCallback(
    async (number: number): Promise<EngineBookings | null> => {
      const mine = ++readCount.current;
      const answer = await client.bookings({ table: source.table, id: source.id, parcelNumber: number });
      if (readCount.current !== mine) return null;
      setAll(answer.bookings);
      setSlot({ bookable: answer.bookable, blockedBy: answer.blockedBy });
      return answer;
    },
    [client, source.table, source.id],
  );

  const load = useCallback(
    async (number: number) => {
      setLoadFailed(false);
      try {
        await read(number);
        setLoaded(true);
      } catch {
        setLoadFailed(true);
        setLoaded(true);
      }
    },
    [read],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  const merge = useCallback((fresh: EngineBooking) => {
    setAll((before) => (before.some((one) => one.id === fresh.id) ? before.map((one) => (one.id === fresh.id ? fresh : one)) : [...before, fresh]));
  }, []);

  const mine = outboundIn(all, mode);
  const holders = holdersIn(mine);
  const booked = holders.filter((one) => one.state === "booked");
  const unknown = holders.filter((one) => one.state === "unknown");
  const underWay = holders.filter((one) => one.state === "reserved" || one.state === "calling");
  const active = holderOf(mine, parcelNumber);
  const unsettled = unknown.length > 0 || underWay.length > 0;
  const many = holders.length > 1 || parcelNumber > 1;
  /* A label bought under the other key is real to someone, and it has no bearing on this parcel. */
  const otherKeyLabel = outboundIn(all, test ? "live" : "test").some((one) => one.state === "booked");

  /** No clear answer to a purchase: say so, then read what really happened. */
  const settle = async (number: number, rate?: EngineRate) => {
    const before = latestOf(mine, number)?.id ?? null;
    setAftermath("checking");
    say(t("addon.shipping-kit.engine.checking.title"));
    try {
      const answer = await read(number);
      // A newer read overtook this one, so this answer says nothing. Never guess: offer to read again.
      if (answer === null) {
        setAftermath("read-failed");
        return;
      }
      const list = outboundIn(answer.bookings, mode);
      const holder = holderOf(list, number);
      if (holder !== null && rate?.handover !== undefined) handovers.current.set(holder.id, rate.handover);
      if (holder?.state === "booked") {
        setAftermath("found");
        setFocusId(holder.id);
        say(t("addon.shipping-kit.engine.found.title"));
      } else if (holder !== null) {
        setAftermath(null);
        setFocusId(holder.id);
        say(t("addon.shipping-kit.engine.unknown.title"));
      } else {
        const latest = latestOf(list, number);
        const settled = latest !== null && latest.id !== before && latest.state === "refused";
        setAftermath(settled ? "safe" : "no-record");
        say(t(settled ? (test ? "addon.shipping-kit.engine.safe.titleTest" : "addon.shipping-kit.engine.safe.title") : "addon.shipping-kit.engine.noRecord.title"));
      }
    } catch {
      setAftermath("read-failed");
      say(t("addon.shipping-kit.engine.readFailed.title"));
    }
  };

  const onAnswered = (booking: EngineBooking, rate: EngineRate) => {
    if (rate.handover !== undefined) handovers.current.set(booking.id, rate.handover);
    if (booking.state !== "booked") {
      void settle(booking.parcelNumber, rate);
      return;
    }
    merge(booking);
    setAdding(false);
    setFocusId(booking.id);
    say(t("addon.shipping-kit.engine.label.title"));
  };

  const onLookUp = (outcome: EngineLookUpOutcome, fresh: EngineBooking) => {
    merge(fresh);
    if (outcome === "found") {
      setAftermath("found");
      setFocusId(fresh.id);
    } else if (outcome === "not-bought") {
      setAftermath("safe");
    }
  };

  const startAgain = () => {
    setAftermath(null);
    setOpened(true);
    void load(parcelNumber);
  };

  const addParcel = () => {
    const next = nextParcel(mine);
    if (next === null) return;
    setSlot(null);
    setParcelNumber(next);
    setAdding(true);
    setOpened(true);
    setAftermath(null);
    void load(next);
  };

  const closeParcel = () => {
    setAdding(false);
    setSlot(null);
    setParcelNumber(1);
    void load(1);
  };

  const canAdd = access.mayBook && booked.length > 0 && !unsettled && !adding && aftermath !== "checking" && nextParcel(mine) !== null;
  const showForm =
    loaded &&
    !loadFailed &&
    (aftermath === null || aftermath === "found") &&
    active === null &&
    slot?.bookable === true &&
    !unsettled &&
    (opened || adding || booked.length === 0);
  const showOpener = showForm && !opened && !adding && booked.length === 0;
  const blocked = loaded && !loadFailed && aftermath === null && active === null && !unsettled && slot !== null && !slot.bookable && (adding || booked.length === 0);
  const locked = booked.length > 0 || unsettled;

  let blockCard = null;
  if (blocked) {
    const by = slot?.blockedBy ?? null;
    const words =
      by === "label-on-order"
        ? { title: t("addon.shipping-kit.engine.blocked.labelOnOrder.title"), body: t("addon.shipping-kit.engine.blocked.labelOnOrder.body") }
        : by === "no-carrier"
          ? {
              title: t("addon.shipping-kit.engine.blocked.noCarrier.title"),
              body: t(access.manages ? "addon.shipping-kit.engine.blocked.noCarrier.manage" : "addon.shipping-kit.engine.blocked.noCarrier.ask"),
            }
          : by === "booking"
            ? { title: t("addon.shipping-kit.engine.blocked.booking.title"), body: t("addon.shipping-kit.engine.blocked.booking.body") }
            : { title: t("addon.shipping-kit.engine.blocked.noRight.title"), body: t("addon.shipping-kit.engine.blocked.noRight.body") };
    blockCard = (
      <StatusCard
        tone="warn"
        icon={<Lock size={20} />}
        testId={`engine-blocked-${by ?? "no-right"}`}
        title={words.title}
        body={words.body}
        actions={
          by === "booking" || by === "label-on-order" ? (
            <FlowButton variant="ghost" onClick={() => void load(parcelNumber)} testId="engine-look-again">
              <RefreshCw size={15} aria-hidden="true" />
              {t("addon.shipping-kit.engine.lookAgain")}
            </FlowButton>
          ) : null
        }
      />
    );
  }

  return (
    <div data-testid="engine-dispatch" style={{ position: "relative", display: "flex", flexDirection: "column", gap: 14, inlineSize: "100%", minInlineSize: 0 }}>
      <LiveRegion said={said} />
      {test && <TestBanner />}

      {!loaded && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "var(--fg-muted)" }}>
          <LoaderCircle size={15} aria-hidden="true" />
          {t("addon.shipping-kit.engine.loading")}
        </div>
      )}

      {loaded && loadFailed && aftermath === null && (
        <StatusCard
          tone="warn"
          icon={<CircleX size={20} />}
          testId="engine-load-failed"
          title={t("addon.shipping-kit.engine.readFailed.title")}
          body={t("addon.shipping-kit.engine.readFailed.body")}
          actions={
            <FlowButton variant="accent" onClick={() => void load(parcelNumber)} testId="engine-look-again">
              <RefreshCw size={15} aria-hidden="true" />
              {t("addon.shipping-kit.engine.lookAgain")}
            </FlowButton>
          }
        />
      )}

      {loaded && !loadFailed && locked && <AddressBlock order={order} locked />}

      {otherKeyLabel && (
        <div role="note" data-testid="engine-other-key" style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--fg-muted)" }}>
          {t(test ? "addon.shipping-kit.engine.otherKey.live" : "addon.shipping-kit.engine.otherKey.test")}
        </div>
      )}

      {aftermath === "checking" && (
        <StatusCard
          tone="info"
          icon={<LoaderCircle size={20} />}
          testId="engine-checking"
          takeFocus
          title={t("addon.shipping-kit.engine.checking.title")}
          body={t("addon.shipping-kit.engine.checking.body")}
        />
      )}

      {aftermath === "found" && (
        <StatusCard
          tone="pos"
          icon={<CircleCheck size={20} />}
          testId="engine-found"
          title={t("addon.shipping-kit.engine.found.title")}
          body={t("addon.shipping-kit.engine.found.body")}
          actions={
            <FlowButton variant="accent" onClick={() => setAftermath(null)} testId="engine-open-label">
              {t("addon.shipping-kit.engine.found.open")}
            </FlowButton>
          }
        />
      )}

      {aftermath === "safe" && (
        <StatusCard
          tone="info"
          icon={<CircleSlash size={20} />}
          testId="engine-safe"
          takeFocus
          title={t(test ? "addon.shipping-kit.engine.safe.titleTest" : "addon.shipping-kit.engine.safe.title")}
          actions={
            <FlowButton variant="accent" onClick={startAgain} testId="engine-start-again">
              <RefreshCw size={15} aria-hidden="true" />
              {t("addon.shipping-kit.engine.refused.getRates")}
            </FlowButton>
          }
        />
      )}

      {aftermath === "no-record" && (
        <StatusCard
          tone="info"
          icon={<CircleSlash size={20} />}
          testId="engine-no-record"
          takeFocus
          title={t("addon.shipping-kit.engine.noRecord.title")}
          body={t("addon.shipping-kit.engine.noRecord.body")}
          actions={
            <FlowButton variant="accent" onClick={startAgain} testId="engine-start-again">
              <RefreshCw size={15} aria-hidden="true" />
              {t("addon.shipping-kit.engine.refused.getRates")}
            </FlowButton>
          }
        />
      )}

      {aftermath === "read-failed" && (
        <StatusCard
          tone="warn"
          icon={<CircleX size={20} />}
          testId="engine-read-failed"
          takeFocus
          title={t("addon.shipping-kit.engine.readFailed.title")}
          body={t("addon.shipping-kit.engine.readFailed.body")}
          actions={
            <FlowButton variant="accent" onClick={() => void settle(parcelNumber)} testId="engine-look-again">
              <RefreshCw size={15} aria-hidden="true" />
              {t("addon.shipping-kit.engine.lookAgain")}
            </FlowButton>
          }
        />
      )}

      {aftermath !== "checking" &&
        unknown.map((booking) => (
          <UnknownCard
            key={booking.id}
            booking={booking}
            access={access}
            client={client}
            orderRef={order.ref}
            many={many}
            say={say}
            takeFocus={focusId === booking.id}
            onLookUp={onLookUp}
            onReleased={(fresh) => {
              merge(fresh);
              setAftermath(null);
              setOpened(true);
              void load(parcelNumber);
            }}
            onStale={() => void load(parcelNumber)}
          />
        ))}

      {aftermath !== "checking" &&
        underWay.map((booking) => (
          <StatusCard
            key={booking.id}
            tone="info"
            icon={<LoaderCircle size={20} />}
            testId="engine-under-way"
            title={t("addon.shipping-kit.engine.underWay.title")}
            body={t("addon.shipping-kit.engine.underWay.body")}
            actions={
              <FlowButton variant="ghost" onClick={() => void load(parcelNumber)} testId="engine-look-again">
                <RefreshCw size={15} aria-hidden="true" />
                {t("addon.shipping-kit.engine.lookAgain")}
              </FlowButton>
            }
          />
        ))}

      {booked.length > 1 && <div style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-muted)" }}>{t("addon.shipping-kit.engine.label.parcels")}</div>}
      {booked.map((booking) => (
        <LabelCard
          key={booking.id}
          booking={booking}
          access={access}
          client={client}
          handover={handovers.current.get(booking.id)}
          orderRef={order.ref}
          many={many}
          takeFocus={focusId === booking.id && aftermath === null}
          say={say}
          onChange={merge}
          onStale={() => void load(parcelNumber)}
        />
      ))}

      {canAdd && (
        <div>
          <FlowButton variant="ghost" onClick={addParcel} testId="engine-add-parcel">
            <Plus size={15} aria-hidden="true" />
            {t("addon.shipping-kit.engine.add.open")}
          </FlowButton>
        </div>
      )}

      {blockCard}

      {adding && slot === null && !loadFailed && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "var(--fg-muted)" }}>
          <LoaderCircle size={15} aria-hidden="true" />
          {t("addon.shipping-kit.engine.loading")}
        </div>
      )}

      {showOpener && (
        <div>
          <FlowButton variant="ghost" onClick={() => setOpened(true)} testId="engine-open">
            <Truck size={15} aria-hidden="true" />
            {t("addon.shipping-kit.engine.open")}
          </FlowButton>
        </div>
      )}

      {showForm && !showOpener && (
        <ParcelBooking
          key={parcelNumber}
          client={client}
          access={access}
          order={order}
          source={source}
          chosen={chosen}
          parcelNumber={parcelNumber}
          say={say}
          onAnswered={onAnswered}
          onUnknown={(rate) => void settle(parcelNumber, rate)}
          onRefused={() => {
            void read(parcelNumber).catch(() => undefined);
          }}
          onClose={adding ? closeParcel : undefined}
        />
      )}

      <NotAffiliated>{t("addon.shipping-kit.engine.notAffiliated")}</NotAffiliated>
    </div>
  );
}
