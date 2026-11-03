/**
 * THE MANIFEST'S WORDS, IN EIGHT LANGUAGES.
 *
 * Every name a person reads in the dashboard — a table, a column, a choice, a
 * role — is written here once, in the order `w()` takes them: English, German,
 * French, Danish, Czech, Arabic, Simplified Chinese, Traditional Chinese.
 * `scripts/manifest.mjs` puts them where the manifest wants them.
 */
export const LOCALES = ['en-US', 'de-DE', 'fr-FR', 'da-DK', 'cs-CZ', 'ar-EG', 'zh-CN', 'zh-TW'] as const;
export type Locale = (typeof LOCALES)[number];
export type Words = Readonly<Record<Locale, string>>;

export const w = (en: string, de: string, fr: string, da: string, cs: string, ar: string, zhCN: string, zhTW: string): Words => ({
  'en-US': en,
  'de-DE': de,
  'fr-FR': fr,
  'da-DK': da,
  'cs-CZ': cs,
  'ar-EG': ar,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
});

/**
 * What the add-on is, in one sentence. The manifest's own `description` is a
 * message with an English fallback (that is all it takes); these are the eight
 * languages of the same sentence, for a listing that shows it in the reader's.
 */
export const DESCRIPTION = w(
  'Products your customers make their own: ready-made designs to fill in, their own words, logos and colours, checked and kept as data for you to proof and make.',
  'Produkte, die Ihre Kundschaft selbst gestaltet: fertige Entwürfe zum Ausfüllen, eigene Worte, Logos und Farben, geprüft und als Daten aufbewahrt, damit Sie einen Probedruck senden und fertigen können.',
  'Des produits que vos clients personnalisent : des modèles prêts à remplir, leurs propres mots, logos et couleurs, vérifiés et gardés comme données pour que vous envoyiez une épreuve et fabriquiez.',
  'Produkter, dine kunder gør til deres egne: færdige design at udfylde, deres egne ord, logoer og farver, kontrolleret og gemt som data, så du kan sende en korrektur og lave dem.',
  'Výrobky, které si zákazníci upraví po svém: hotové návrhy k vyplnění, vlastní slova, loga a barvy, zkontrolované a uložené jako data, abyste mohli poslat náhled a vyrobit je.',
  'منتجات يجعلها عملاؤك خاصة بهم: تصاميم جاهزة للتعبئة، وكلماتهم وشعاراتهم وألوانهم، تُفحص وتُحفظ كبيانات لترسل بروفة وتصنعها.',
  '让顾客亲手定制的商品：可直接填写的现成设计，他们自己的文字、标志和颜色，经过检查并以数据保存，供您发送校样并制作。',
  '讓顧客親手訂製的商品：可直接填寫的現成設計，他們自己的文字、標誌和顏色，經過檢查並以資料保存，供您寄送校樣並製作。',
);

/* ── words many tables share ─────────────────────────────────────────────── */

export const W = {
  app: w('App', 'App', 'Application', 'App', 'Aplikace', 'التطبيق', '应用', '應用程式'),
  name: w('Name', 'Name', 'Nom', 'Navn', 'Název', 'الاسم', '名称', '名稱'),
  position: w('Order in the list', 'Reihenfolge', 'Ordre dans la liste', 'Rækkefølge', 'Pořadí', 'الترتيب في القائمة', '列表中的顺序', '清單中的順序'),
  base: w('Base', 'Grundform', 'Support', 'Grundform', 'Základ', 'القاعدة', '底材', '底材'),
  piece: w('Piece', 'Teil', 'Pièce', 'Del', 'Díl', 'القطعة', '部件', '部件'),
  area: w('Area', 'Bereich', 'Zone', 'Område', 'Oblast', 'المنطقة', '区域', '區域'),
  readyDesign: w('Ready-made design', 'Fertiger Entwurf', 'Modèle prêt à l’emploi', 'Færdigt design', 'Hotový návrh', 'تصميم جاهز', '现成设计', '現成設計'),
  feature: w('Priced feature', 'Aufpreis-Option', 'Option payante', 'Tilvalg med pris', 'Placená volba', 'ميزة بسعر', '加价选项', '加價選項'),
  side: w('Side', 'Seite', 'Face', 'Side', 'Strana', 'الوجه', '面', '面'),
  code: w('Code', 'Code', 'Code', 'Kode', 'Kód', 'الرمز', '代码', '代碼'),
  key: w('Key', 'Schlüssel', 'Clé', 'Nøgle', 'Klíč', 'المفتاح', '键', '鍵'),
  rules: w('Rules', 'Regeln', 'Règles', 'Regler', 'Pravidla', 'القواعد', '规则', '規則'),
  required: w('Required', 'Pflicht', 'Obligatoire', 'Påkrævet', 'Povinné', 'مطلوب', '必填', '必填'),
  left: w('From the left edge (mm)', 'Vom linken Rand (mm)', 'Depuis le bord gauche (mm)', 'Fra venstre kant (mm)', 'Od levého okraje (mm)', 'من الحافة اليسرى (مم)', '距左边缘（毫米）', '距左邊緣（公釐）'),
  top: w('From the top edge (mm)', 'Vom oberen Rand (mm)', 'Depuis le bord supérieur (mm)', 'Fra øverste kant (mm)', 'Od horního okraje (mm)', 'من الحافة العليا (مم)', '距上边缘（毫米）', '距上邊緣（公釐）'),
  width: w('Width (mm)', 'Breite (mm)', 'Largeur (mm)', 'Bredde (mm)', 'Šířka (mm)', 'العرض (مم)', '宽度（毫米）', '寬度（公釐）'),
  height: w('Height (mm)', 'Höhe (mm)', 'Hauteur (mm)', 'Højde (mm)', 'Výška (mm)', 'الارتفاع (مم)', '高度（毫米）', '高度（公釐）'),
  active: w('Offered', 'Angeboten', 'Proposé', 'Tilbydes', 'Nabízeno', 'معروض', '提供中', '提供中'),
};

/** The two sides of a page. */
export const SIDES = {
  front: w('Front', 'Vorderseite', 'Recto', 'Forside', 'Přední strana', 'الوجه الأمامي', '正面', '正面'),
  back: w('Back', 'Rückseite', 'Verso', 'Bagside', 'Zadní strana', 'الوجه الخلفي', '背面', '背面'),
};

/* ── roles ───────────────────────────────────────────────────────────────── */

export const ROLE_NAMES = {
  designer: w('Customiser designer', 'Customiser-Gestaltung', 'Conception Customiser', 'Customiser-designer', 'Návrhář Customiseru', 'مصمم Customiser', 'Customiser 设计员', 'Customiser 設計員'),
  reader: w('Customiser reader', 'Customiser lesen', 'Lecture Customiser', 'Customiser-læser', 'Čtenář Customiseru', 'قارئ Customiser', 'Customiser 查看者', 'Customiser 檢視者'),
};
