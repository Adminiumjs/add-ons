/**
 * THE ONE E-MAIL THE CUSTOMISER SENDS: A SAVED DESIGN'S PRIVATE LINK.
 *
 * When a customer presses "Save and come back" and gives their address, the
 * design is saved with it, and Adminium mails the design's own link there.
 * The link is the design's own code (`link_token`, a code no staff member
 * reads), put after the address of the app's page that opens a saved design:
 * `{{app_url.design}}#{{design.link_token}}`. Each shop app declares that page
 * on its customer side under the route key `customiserDesign`; an app that
 * declares none sends no button (the block is only drawn with the address).
 *
 * A design saved without an address (one put straight in the basket) is
 * mailed nothing: Adminium skips a message with no one to send it to.
 *
 * The mail never keeps a design: one nobody ordered still goes 90 days after
 * its last change (or when its customer deletes it), and the log keeps the
 * message as it was sent, naming no design.
 */
import { w, type Words } from './words.ts';

type Column = Record<string, unknown>;

/** The key of the customer page each shop app declares for a saved design's link. */
export const DESIGN_ROUTE = 'customiserDesign';
export const MAIL_TABLE = 'design_mails';
export const LINK_KIND = 'design-link';
export const LINK_TEMPLATE = 'customiser-design-link';

const STATUS: Record<string, Words> = {
  queued: w('Waiting', 'Wartet', 'En attente', 'Venter', 'Čeká', 'في الانتظار', '等待中', '等待中'),
  sent: w('Sent', 'Gesendet', 'Envoyé', 'Sendt', 'Odesláno', 'أُرسل', '已发送', '已傳送'),
  failed: w('Failed', 'Fehlgeschlagen', 'Échec', 'Mislykkedes', 'Selhalo', 'فشل', '失败', '失敗'),
  skipped: w('Not sent', 'Nicht gesendet', 'Non envoyé', 'Ikke sendt', 'Neodesláno', 'لم يُرسل', '未发送', '未傳送'),
};

const enumOf = (ref: string, values: Record<string, Words>, label: Words, extra: Column = {}): Column => ({ ref, type: 'enum', enum: Object.keys(values), ...extra, rules: { enumLabels: { labels: values } }, label });

/** The log of the mails sent: one row a message, which Adminium writes and sends. */
export function mailTable(): Record<string, unknown> {
  return {
    ref: MAIL_TABLE,
    label: w('Design e-mail', 'Entwurfs-E-Mail', 'E-mail de création', 'Design-e-mail', 'E-mail k návrhu', 'بريد التصميم', '设计邮件', '設計郵件'),
    labelPlural: w('Design e-mails', 'Entwurfs-E-Mails', 'E-mails de création', 'Design-e-mails', 'E-maily k návrhům', 'رسائل التصاميم', '设计邮件', '設計郵件'),
    columns: [
      { ref: 'id', type: 'int', role: 'pk' },
      enumOf('kind', { [LINK_KIND]: w('The design’s private link', 'Privater Link zum Entwurf', 'Lien privé vers la création', 'Designets private link', 'Soukromý odkaz na návrh', 'الرابط الخاص بالتصميم', '设计的私人链接', '設計的私人連結') }, w('Kind of mail', 'Art der E-Mail', 'Type d’e-mail', 'Type af mail', 'Druh e-mailu', 'نوع البريد', '邮件类型', '郵件類型')),
      enumOf('status', STATUS, w('Status', 'Status', 'Statut', 'Status', 'Stav', 'الحالة', '状态', '狀態'), { default: 'queued' }),
      { ref: 'to_address', type: 'text', maxLength: 254, nullable: true, rules: { personal: true }, label: w('Sent to', 'Gesendet an', 'Envoyé à', 'Sendt til', 'Odesláno na', 'أُرسل إلى', '发送至', '傳送至') },
      { ref: 'sent_at', type: 'timestamptz', nullable: true, label: w('Sent at', 'Gesendet am', 'Envoyé le', 'Sendt den', 'Odesláno', 'أُرسل في', '发送时间', '傳送時間') },
      { ref: 'error', type: 'text', maxLength: 500, nullable: true, label: w('What went wrong', 'Was schiefging', 'Ce qui n’a pas marché', 'Hvad gik galt', 'Co se nepovedlo', 'ما الخطأ', '出错原因', '出錯原因') },
      { ref: 'design_id', type: 'fk', references: 'designs', nullable: true, label: w('Design', 'Entwurf', 'Création', 'Design', 'Návrh', 'التصميم', '设计', '設計') },
    ],
  };
}

export function outbox(): Record<string, unknown> {
  return {
    table: MAIL_TABLE,
    columns: { kind: 'kind', status: 'status', to: 'to_address', sentAt: 'sent_at', error: 'error' },
    links: { design: 'design_id' },
    recipient: { via: 'design_id', table: 'designs', email: 'email' },
    pages: { app: { design: DESIGN_ROUTE } },
    kinds: { [LINK_KIND]: LINK_TEMPLATE },
    classes: { [LINK_KIND]: 'service' },
    producers: [{ kind: LINK_KIND, link: 'design_id', onCreate: { table: 'designs' } }],
  };
}

interface Letter {
  subject: string;
  heading: string;
  body: string;
  button: string;
  keep: string;
}

const LETTERS: Readonly<Record<string, Letter>> = {
  'en-US': { subject: 'Your design is saved', heading: 'Your design is saved', body: 'Here is your private link to come back to it. Nobody else can open it.', button: 'Open your design', keep: 'We keep a design for 90 days after its last change, unless you order it.' },
  'de-DE': { subject: 'Ihr Entwurf ist gespeichert', heading: 'Ihr Entwurf ist gespeichert', body: 'Hier ist Ihr privater Link, um später weiterzumachen. Niemand sonst kann ihn öffnen.', button: 'Entwurf öffnen', keep: 'Wir bewahren einen Entwurf 90 Tage nach seiner letzten Änderung auf, es sei denn, Sie bestellen ihn.' },
  'fr-FR': { subject: 'Votre création est enregistrée', heading: 'Votre création est enregistrée', body: 'Voici votre lien privé pour y revenir. Personne d’autre ne peut l’ouvrir.', button: 'Ouvrir votre création', keep: 'Nous gardons une création 90 jours après sa dernière modification, sauf si vous la commandez.' },
  'da-DK': { subject: 'Dit design er gemt', heading: 'Dit design er gemt', body: 'Her er dit private link, så du kan vende tilbage til det. Ingen andre kan åbne det.', button: 'Åbn dit design', keep: 'Vi gemmer et design i 90 dage efter sidste ændring, medmindre du bestiller det.' },
  'cs-CZ': { subject: 'Váš návrh je uložen', heading: 'Váš návrh je uložen', body: 'Tady je váš soukromý odkaz, abyste se k němu mohli vrátit. Nikdo jiný ho neotevře.', button: 'Otevřít návrh', keep: 'Návrh uchováváme 90 dní od poslední změny, pokud si ho neobjednáte.' },
  'ar-EG': { subject: 'تم حفظ تصميمك', heading: 'تم حفظ تصميمك', body: 'إليك رابطك الخاص للعودة إليه. لا يستطيع أحد غيرك فتحه.', button: 'افتح تصميمك', keep: 'نحتفظ بالتصميم 90 يومًا بعد آخر تغيير له، ما لم تطلبه.' },
  'zh-CN': { subject: '你的设计已保存', heading: '你的设计已保存', body: '这是你的私人链接，可随时回来继续。其他人无法打开。', button: '打开你的设计', keep: '设计在最后一次更改后保留 90 天，除非你下单。' },
  'zh-TW': { subject: '你的設計已儲存', heading: '你的設計已儲存', body: '這是你的私人連結，可隨時回來繼續。其他人無法開啟。', button: '開啟你的設計', keep: '設計在最後一次變更後保留 90 天，除非你下單。' },
};

export function emailTemplates(): Record<string, unknown>[] {
  return [
    {
      key: LINK_TEMPLATE,
      name: w('A saved design’s link', 'Link zu einem gespeicherten Entwurf', 'Lien d’une création enregistrée', 'Link til et gemt design', 'Odkaz na uložený návrh', 'رابط تصميم محفوظ', '已保存设计的链接', '已儲存設計的連結'),
      vars: ['app_url.design', 'design.link_token'],
      locales: Object.fromEntries(
        Object.entries(LETTERS).map(([tag, letter]) => [
          tag,
          {
            subject: letter.subject,
            blocks: [
              { block: 'email.heading', data: { text: letter.heading } },
              { block: 'email.text', data: { text: letter.body } },
              { block: 'email.button', data: { label: letter.button, url: '{{app_url.design}}#{{design.link_token}}', onlyWith: 'app_url.design' } },
              { block: 'email.text', data: { text: letter.keep } },
            ],
            footer: '{{appName}}',
          },
        ]),
      ),
    },
  ];
}
