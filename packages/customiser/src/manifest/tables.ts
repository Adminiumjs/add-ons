/**
 * THE CUSTOMISER'S TABLES.
 *
 * A customisable product has four things the shop sets up and one thing the
 * customer makes:
 *
 * - a **base** (what gets customised: a flat page, a flat piece, a kit of
 *   pieces, a 3D-printed item), with the **pieces** of a kit and the
 *   **areas** where a customer may add words or a logo;
 * - **ready-made designs** on a base, each made of **parts** the shop locks or
 *   lets the customer change, within its rules;
 * - the **fonts**, **palettes** and **colours** those rules offer;
 * - the **priced features** a design may use ("Your own logo"). Their prices
 *   are the app's: each is an option row of the app's own, priced like any
 *   other option, and naming the feature by its code;
 * - the customer's **design**: which ready-made design or base it starts
 *   from and what they chose, kept as data (never a picture), and the
 *   **versions** the shop proofs and makes from.
 *
 * One install may run two shop apps on one Customiser. Every table but the
 * settings row carries `app`, the key of the app a row is for, and the public
 * entries are held to it.
 *
 * Sizes are millimetres throughout. A part's own text sizes are in its rules,
 * in the unit its kind of base uses (points on a page, millimetres on a piece).
 */
import { SIDES, W, w, type Words } from './words.ts';

type Column = Record<string, unknown>;
type Table = Record<string, unknown>;

const pk: Column = { ref: 'id', type: 'int', role: 'pk' };
const col = (ref: string, type: string, label: Words, extra: Column = {}): Column => ({ ref, type, ...extra, label });
const choice = (ref: string, values: Record<string, Words>, label: Words, extra: Column = {}): Column => ({
  ref,
  type: 'enum',
  enum: Object.keys(values),
  ...extra,
  rules: { ...((extra['rules'] as Column | undefined) ?? {}), enumLabels: { labels: values } },
  label,
});
const mm = (ref: string, label: Words, extra: Column = {}): Column => col(ref, 'decimal', label, { scale: 2, ...extra, rules: { validation: { min: 0, max: 5000 } } });
const app: Column = col('app', 'text', W.app, { maxLength: 40, nullable: true });
const position: Column = col('position', 'int', W.position, { default: 0 });
const name = (maxLength = 120): Column => col('name', 'text', W.name, { maxLength });
const link = (ref: string, references: string, label: Words, nullable = true): Column => ({ ref, type: 'fk', references, ...(nullable ? { nullable: true } : {}), label });
const side: Column = choice('side', SIDES, W.side, { nullable: true });
const box = [col('x_mm', 'decimal', W.left, { scale: 2, nullable: true }), col('y_mm', 'decimal', W.top, { scale: 2, nullable: true }), mm('w_mm', W.width, { nullable: true }), mm('h_mm', W.height, { nullable: true })];
const rules = (label: Words = W.rules): Column => col('rules', 'json', label, { nullable: true });
const both = (one: Words, many: Words) => ({ label: one, labelPlural: many });

/** The ten megabytes a customer's own file may be, as the comps say ("up to 10 MB"). */
export const CUSTOMER_FILE_BYTES = 10 * 1024 * 1024;
/** A never-ordered design is let go this many days after it last changed. */
export const DESIGN_KEEP_DAYS = 90;

export function tables(): Table[] {
  return [
    {
      ref: 'settings',
      ...both(w('Customiser settings', 'Customiser-Einstellungen', 'Paramètres du Customiser', 'Customiser-indstillinger', 'Nastavení Customiseru', 'إعدادات Customiser', 'Customiser 设置', 'Customiser 設定'), w('Customiser settings', 'Customiser-Einstellungen', 'Paramètres du Customiser', 'Customiser-indstillinger', 'Nastavení Customiseru', 'إعدادات Customiser', 'Customiser 设置', 'Customiser 設定')),
      columns: [
        pk,
        choice(
          'length_unit',
          { mm: w('Millimetres', 'Millimeter', 'Millimètres', 'Millimeter', 'Milimetry', 'المليمترات', '毫米', '公釐'), in: w('Inches', 'Zoll', 'Pouces', 'Tommer', 'Palce', 'البوصات', '英寸', '英寸') },
          w('Sizes shown in', 'Maße anzeigen in', 'Tailles affichées en', 'Mål vist i', 'Rozměry zobrazit v', 'تُعرض المقاسات بـ', '尺寸显示单位', '尺寸顯示單位'),
          { default: 'mm' },
        ),
        col('default_bleed_mm', 'decimal', w('Bleed on a new page (mm)', 'Beschnitt einer neuen Seite (mm)', 'Fond perdu d’une nouvelle page (mm)', 'Beskæring på en ny side (mm)', 'Spadávka nové stránky (mm)', 'هامش القص لصفحة جديدة (مم)', '新页面的出血（毫米）', '新頁面的出血（公釐）'), { scale: 2, default: 3, rules: { validation: { min: 0, max: 20 } } }),
        col('default_safe_mm', 'decimal', w('Safe line on a new page (mm)', 'Sicherheitsabstand einer neuen Seite (mm)', 'Marge de sécurité d’une nouvelle page (mm)', 'Sikkerhedsmargen på en ny side (mm)', 'Bezpečný okraj nové stránky (mm)', 'خط الأمان لصفحة جديدة (مم)', '新页面的安全线（毫米）', '新頁面的安全線（公釐）'), { scale: 2, default: 4, rules: { validation: { min: 0, max: 50 } } }),
        col('one_colour_threshold', 'int', w('Where light becomes dark, to start with (%)', 'Ab wann Hell zu Dunkel wird, zu Beginn (%)', 'Seuil entre clair et foncé, au départ (%)', 'Hvor lyst bliver mørkt, til at begynde med (%)', 'Kde světlá přechází v tmavou, na začátku (%)', 'حيث يصبح الفاتح داكنًا، في البداية (%)', '明暗分界的初始值（%）', '明暗分界的初始值（%）'), { default: 50, rules: { validation: { min: 1, max: 99 } } }),
        col('smallest_line_mm', 'decimal', w('Thinnest line the machine keeps (mm)', 'Dünnste Linie, die die Maschine schafft (mm)', 'Trait le plus fin que garde la machine (mm)', 'Tyndeste streg maskinen kan lave (mm)', 'Nejtenčí čára, kterou stroj zvládne (mm)', 'أدق خط تحتفظ به الآلة (مم)', '机器可保留的最细线条（毫米）', '機器可保留的最細線條（公釐）'), { scale: 2, default: 0.2, rules: { validation: { min: 0, max: 5 } } }),
        col('min_dpi', 'int', w('Sharpness a picture needs at its printed size (dpi)', 'Nötige Bildschärfe in Druckgröße (dpi)', 'Netteté requise à la taille imprimée (dpi)', 'Skarphed et billede skal have i trykt størrelse (dpi)', 'Potřebná ostrost obrázku v tištěné velikosti (dpi)', 'الدقة التي تحتاجها الصورة بحجم الطباعة (نقطة/بوصة)', '图片在印刷尺寸下所需的清晰度（dpi）', '圖片在印刷尺寸下所需的清晰度（dpi）'), { default: 150, rules: { validation: { min: 50, max: 1200 } } }),
      ],
    },
    {
      ref: 'bases',
      keyField: 'name',
      ...both(W.base, w('Bases', 'Grundformen', 'Supports', 'Grundformer', 'Základy', 'القواعد', '底材', '底材')),
      columns: [
        pk,
        app,
        name(),
        choice(
          'kind',
          {
            page: w('A flat page', 'Eine flache Seite', 'Une page à plat', 'En flad side', 'Plochá stránka', 'صفحة مسطحة', '平面页面', '平面頁面'),
            piece: w('A flat piece', 'Ein flaches Teil', 'Une pièce plate', 'Et fladt stykke', 'Plochý díl', 'قطعة مسطحة', '平面部件', '平面部件'),
            kit: w('A kit of pieces', 'Ein Bausatz aus Teilen', 'Un kit de pièces', 'Et sæt af dele', 'Stavebnice z dílů', 'مجموعة قطع', '成套部件', '成套部件'),
            printed: w('A 3D-printed item', 'Ein 3D-gedrucktes Stück', 'Un objet imprimé en 3D', 'En 3D-printet genstand', 'Předmět z 3D tisku', 'قطعة مطبوعة ثلاثية الأبعاد', '3D 打印件', '3D 列印件'),
          },
          w('Kind of base', 'Art der Grundform', 'Type de support', 'Type grundform', 'Druh základu', 'نوع القاعدة', '底材类型', '底材類型'),
        ),
        mm('width_mm', W.width),
        mm('height_mm', W.height),
        mm('depth_mm', w('Depth (mm)', 'Tiefe (mm)', 'Profondeur (mm)', 'Dybde (mm)', 'Hloubka (mm)', 'العمق (مم)', '深度（毫米）', '深度（公釐）'), { nullable: true }),
        mm('corner_mm', w('Corner radius (mm)', 'Eckenradius (mm)', 'Rayon des coins (mm)', 'Hjørneradius (mm)', 'Poloměr rohů (mm)', 'نصف قطر الزاوية (مم)', '圆角半径（毫米）', '圓角半徑（公釐）'), { nullable: true }),
        mm('bleed_mm', w('Bleed (mm)', 'Beschnitt (mm)', 'Fond perdu (mm)', 'Beskæring (mm)', 'Spadávka (mm)', 'هامش القص (مم)', '出血（毫米）', '出血（公釐）'), { nullable: true }),
        mm('safe_mm', w('Safe line (mm)', 'Sicherheitsabstand (mm)', 'Marge de sécurité (mm)', 'Sikkerhedsmargen (mm)', 'Bezpečný okraj (mm)', 'خط الأمان (مم)', '安全线（毫米）', '安全線（公釐）'), { nullable: true }),
        col('sides', 'int', w('Sides', 'Seiten', 'Faces', 'Sider', 'Strany', 'الأوجه', '面数', '面數'), { nullable: true, rules: { validation: { min: 1, max: 2 } } }),
        col('material', 'text', w('Material', 'Material', 'Matière', 'Materiale', 'Materiál', 'الخامة', '材料', '材料'), { maxLength: 80, nullable: true }),
        mm('thickness_mm', w('Thickness (mm)', 'Stärke (mm)', 'Épaisseur (mm)', 'Tykkelse (mm)', 'Tloušťka (mm)', 'السماكة (مم)', '厚度（毫米）', '厚度（公釐）'), { nullable: true }),
        // TODO(J10): a cleaned SVG outline, `rules.file { accept: ['svg'] }`, once Adminium takes the kind.
        col('outline_file', 'text', w('The outline', 'Die Kontur', 'Le contour', 'Omridset', 'Obrys', 'المخطط الخارجي', '轮廓', '輪廓'), { maxLength: 64, nullable: true }),
        /*
         * What this base offers every part and area on it: the fonts (by family)
         * and the finishes (by colour code) the shop switched on for it in the
         * set-up's "Fonts & finishes" step. An area or a part offers some of these.
         */
        col('offered', 'json', w('Fonts and finishes offered', 'Angebotene Schriften und Ausführungen', 'Polices et finitions proposées', 'Tilbudte skrifttyper og overflader', 'Nabízená písma a povrchové úpravy', 'الخطوط والتشطيبات المعروضة', '提供的字体和表面处理', '提供的字型和表面處理'), { nullable: true }),
        choice(
          'state',
          {
            draft: w('Not offered yet', 'Noch nicht angeboten', 'Pas encore proposé', 'Tilbydes ikke endnu', 'Zatím nenabízeno', 'غير معروض بعد', '尚未提供', '尚未提供'),
            published: w('Offered for customising', 'Zum Gestalten angeboten', 'Proposé à personnaliser', 'Tilbydes til tilpasning', 'Nabízeno k úpravě', 'معروض للتخصيص', '已开放定制', '已開放訂製'),
          },
          w('Offered', 'Angeboten', 'Proposé', 'Tilbydes', 'Nabízeno', 'معروض', '提供状态', '提供狀態'),
          { default: 'draft' },
        ),
        position,
      ],
    },
    {
      // The pieces of a kit, each cut flat from its own outline. The 3D side of a kit comes later; its key columns are here now.
      ref: 'base_pieces',
      keyField: 'name',
      unique: [['base_id', 'code']],
      ...both(W.piece, w('Pieces', 'Teile', 'Pièces', 'Dele', 'Díly', 'القطع', '部件', '部件')),
      columns: [
        pk,
        app,
        link('base_id', 'bases', W.base, false),
        col('code', 'text', w('Piece number', 'Teilnummer', 'Numéro de pièce', 'Delnummer', 'Číslo dílu', 'رقم القطعة', '部件编号', '部件編號'), { maxLength: 16 }),
        name(),
        mm('width_mm', W.width),
        mm('height_mm', W.height),
        col('layers', 'json', w('Layers', 'Ebenen', 'Calques', 'Lag', 'Vrstvy', 'الطبقات', '图层', '圖層'), { nullable: true }),
        // TODO(J10): the piece's cleaned SVG, `rules.file { accept: ['svg'] }`.
        col('file', 'text', w('The piece’s outline', 'Kontur des Teils', 'Contour de la pièce', 'Delens omrids', 'Obrys dílu', 'مخطط القطعة', '部件轮廓', '部件輪廓'), { maxLength: 64, nullable: true }),
        position,
      ],
    },
    {
      // Where a customer may add words or a logo: on a page's side, a piece, or a face the shop marked on a model.
      ref: 'base_areas',
      keyField: 'name',
      unique: [['base_id', 'code']],
      ...both(W.area, w('Areas', 'Bereiche', 'Zones', 'Områder', 'Oblasti', 'المناطق', '区域', '區域')),
      columns: [
        pk,
        app,
        link('base_id', 'bases', W.base, false),
        col('code', 'text', W.key, { maxLength: 40 }),
        name(),
        side,
        link('piece_id', 'base_pieces', W.piece),
        col('face', 'text', w('Marked face', 'Markierte Fläche', 'Face marquée', 'Markeret flade', 'Označená plocha', 'الوجه المحدد', '已标记的面', '已標記的面'), { maxLength: 40, nullable: true }),
        choice(
          'shape',
          { rect: w('Rectangle', 'Rechteck', 'Rectangle', 'Rektangel', 'Obdélník', 'مستطيل', '矩形', '矩形'), oval: w('Oval', 'Oval', 'Ovale', 'Oval', 'Ovál', 'بيضاوي', '椭圆', '橢圓') },
          w('Shape', 'Form', 'Forme', 'Form', 'Tvar', 'الشكل', '形状', '形狀'),
          { default: 'rect' },
        ),
        ...box,
        choice(
          'takes',
          {
            words: w('Words', 'Text', 'Texte', 'Tekst', 'Text', 'كلمات', '文字', '文字'),
            logo: w('A logo', 'Ein Logo', 'Un logo', 'Et logo', 'Logo', 'شعار', '标志', '標誌'),
            both: w('Both', 'Beides', 'Les deux', 'Begge', 'Obojí', 'كلاهما', '两者', '兩者'),
          },
          w('What it takes', 'Was hineinkommt', 'Ce qu’elle accepte', 'Hvad det rummer', 'Co pojme', 'ما تقبله', '可放内容', '可放內容'),
          { default: 'words' },
        ),
        col('required', 'bool', W.required, { default: false }),
        rules(),
        link('feature_id', 'features', W.feature),
        position,
      ],
    },
    {
      // A shop's ready-made design. Its own table, apart from customers' designs: anyone may read these, and nobody may read those.
      ref: 'ready_designs',
      keyField: 'name',
      ...both(W.readyDesign, w('Ready-made designs', 'Fertige Entwürfe', 'Modèles prêts à l’emploi', 'Færdige design', 'Hotové návrhy', 'التصاميم الجاهزة', '现成设计', '現成設計')),
      columns: [
        pk,
        app,
        link('base_id', 'bases', W.base, false),
        name(),
        col('tags', 'json', w('Gallery filters', 'Galerie-Filter', 'Filtres de la galerie', 'Gallerifiltre', 'Filtry galerie', 'عوامل تصفية المعرض', '图库筛选', '圖庫篩選'), { nullable: true }),
        col('layouts', 'json', w('Layout choices', 'Layout-Varianten', 'Mises en page proposées', 'Layoutvalg', 'Volby rozvržení', 'خيارات التخطيط', '版式选项', '版式選項'), { nullable: true }),
        choice(
          'state',
          {
            draft: w('Hidden', 'Ausgeblendet', 'Masqué', 'Skjult', 'Skryto', 'مخفي', '已隐藏', '已隱藏'),
            published: w('Shown to customers', 'Für Kunden sichtbar', 'Visible des clients', 'Vises for kunder', 'Zobrazeno zákazníkům', 'ظاهر للعملاء', '向顾客展示', '向顧客展示'),
          },
          w('Shown', 'Sichtbar', 'Visible', 'Vises', 'Zobrazení', 'الظهور', '展示', '展示'),
          { default: 'draft' },
        ),
        col('preview_file', 'text', w('Preview picture', 'Vorschaubild', 'Image d’aperçu', 'Eksempelbillede', 'Náhledový obrázek', 'صورة المعاينة', '预览图', '預覽圖'), { maxLength: 64, nullable: true, semantic: 'image', rules: { file: { accept: ['png', 'jpeg', 'webp'], maxBytes: 2 * 1024 * 1024 } } }),
        position,
      ],
    },
    {
      // The parts of a ready-made design: each the shop's (locked) or the customer's to change within its rules.
      ref: 'ready_parts',
      keyField: 'name',
      ...both(w('Part', 'Element', 'Élément', 'Element', 'Prvek', 'الجزء', '元素', '元素'), w('Parts', 'Elemente', 'Éléments', 'Elementer', 'Prvky', 'الأجزاء', '元素', '元素')),
      columns: [
        pk,
        app,
        link('ready_design_id', 'ready_designs', W.readyDesign, false),
        col('code', 'text', W.key, { maxLength: 40 }),
        name(),
        choice(
          'kind',
          {
            text: w('Words', 'Text', 'Texte', 'Tekst', 'Text', 'كلمات', '文字', '文字'),
            picture: w('A picture or logo', 'Ein Bild oder Logo', 'Une image ou un logo', 'Et billede eller logo', 'Obrázek nebo logo', 'صورة أو شعار', '图片或标志', '圖片或標誌'),
            colour: w('A colour', 'Eine Farbe', 'Une couleur', 'En farve', 'Barva', 'لون', '颜色', '顏色'),
            choice: w('A choice', 'Eine Auswahl', 'Un choix', 'Et valg', 'Volba', 'اختيار', '选项', '選項'),
            shape: w('A shape', 'Eine Form', 'Une forme', 'En form', 'Tvar', 'شكل', '形状', '形狀'),
          },
          w('Kind of part', 'Art des Elements', 'Type d’élément', 'Type element', 'Druh prvku', 'نوع الجزء', '元素类型', '元素類型'),
        ),
        col('locked', 'bool', w('Set by the shop', 'Vom Geschäft festgelegt', 'Fixé par la boutique', 'Fastlagt af butikken', 'Určuje obchod', 'يحدده المتجر', '由店铺设定', '由店家設定'), { default: false }),
        col('required', 'bool', W.required, { default: false }),
        side,
        col('layout', 'text', w('Layout', 'Layout', 'Mise en page', 'Layout', 'Rozvržení', 'التخطيط', '版式', '版式'), { maxLength: 40, nullable: true }),
        link('area_id', 'base_areas', W.area),
        link('piece_id', 'base_pieces', W.piece),
        ...box,
        rules(),
        col('value', 'json', w('What it starts as', 'Anfangswert', 'Valeur de départ', 'Startværdi', 'Výchozí hodnota', 'القيمة الأولى', '初始内容', '初始內容'), { nullable: true }),
        link('feature_id', 'features', W.feature),
        position,
      ],
    },
    {
      // Typefaces a design may offer: the open-licence starter set Adminium writes at install, and the shop's own.
      ref: 'fonts',
      keyField: 'name',
      ...both(w('Font', 'Schrift', 'Police', 'Skrifttype', 'Písmo', 'الخط', '字体', '字型'), w('Fonts', 'Schriften', 'Polices', 'Skrifttyper', 'Písma', 'الخطوط', '字体', '字型')),
      columns: [
        pk,
        app,
        col('family', 'text', w('Font family', 'Schriftfamilie', 'Famille de police', 'Skriftfamilie', 'Rodina písma', 'عائلة الخط', '字体家族', '字型家族'), { maxLength: 80 }),
        name(80),
        col('style', 'text', w('Style', 'Stil', 'Style', 'Stil', 'Styl', 'النمط', '风格', '風格'), { maxLength: 40, nullable: true }),
        col('weights', 'text', w('Weights', 'Schriftschnitte', 'Graisses', 'Vægte', 'Řezy', 'الأوزان', '字重', '字重'), { maxLength: 40, nullable: true }),
        col('licence', 'text', w('Licence', 'Lizenz', 'Licence', 'Licens', 'Licence', 'الترخيص', '许可', '授權'), { maxLength: 120 }),
        col('starter', 'bool', w('In the starter set', 'Im Grundsortiment', 'Dans le jeu de départ', 'I startsættet', 'V základní sadě', 'ضمن المجموعة الأساسية', '属于入门套装', '屬於入門套組'), { default: false }),
        mm('smallest_mm', w('Smallest size that still reads (mm)', 'Kleinste noch lesbare Größe (mm)', 'Plus petite taille lisible (mm)', 'Mindste læselige størrelse (mm)', 'Nejmenší čitelná velikost (mm)', 'أصغر حجم يظل مقروءًا (مم)', '仍可辨认的最小尺寸（毫米）', '仍可辨認的最小尺寸（公釐）'), { nullable: true }),
        // TODO(J10): the WOFF2 file, `rules.file { accept: ['woff2'] }`, served to visitors through the entry's assets.
        col('file', 'text', w('Font file', 'Schriftdatei', 'Fichier de police', 'Skriftfil', 'Soubor písma', 'ملف الخط', '字体文件', '字型檔案'), { maxLength: 64, nullable: true }),
        col('active', 'bool', W.active, { default: true }),
      ],
    },
    {
      // A set of colours or finishes a part may offer: a design's own (Paper, Ink, Accent) or the shop's (the colours it prints in).
      ref: 'palettes',
      keyField: 'name',
      ...both(w('Palette', 'Palette', 'Palette', 'Palet', 'Paleta', 'لوحة الألوان', '色板', '色票'), w('Palettes', 'Paletten', 'Palettes', 'Paletter', 'Palety', 'لوحات الألوان', '色板', '色票')),
      columns: [
        pk,
        app,
        link('ready_design_id', 'ready_designs', W.readyDesign),
        choice(
          'kind',
          {
            colours: w('Colours', 'Farben', 'Couleurs', 'Farver', 'Barvy', 'ألوان', '颜色', '顏色'),
            finishes: w('Finishes', 'Ausführungen', 'Finitions', 'Overflader', 'Povrchové úpravy', 'التشطيبات', '表面处理', '表面處理'),
          },
          w('Kind', 'Art', 'Type', 'Type', 'Druh', 'النوع', '类型', '類型'),
          { default: 'colours' },
        ),
        // What a part's rules and a design's choices name it by ("pla", "harbour").
        col('code', 'text', W.key, { maxLength: 40 }),
        name(80),
        position,
      ],
    },
    {
      ref: 'palette_colours',
      keyField: 'name',
      unique: [['palette_id', 'code']],
      ...both(w('Colour', 'Farbe', 'Couleur', 'Farve', 'Barva', 'اللون', '颜色', '顏色'), w('Colours', 'Farben', 'Couleurs', 'Farver', 'Barvy', 'الألوان', '颜色', '顏色')),
      columns: [
        pk,
        app,
        link('palette_id', 'palettes', w('Palette', 'Palette', 'Palette', 'Palet', 'Paleta', 'لوحة الألوان', '色板', '色票'), false),
        col('code', 'text', W.key, { maxLength: 40 }),
        choice(
          'role',
          {
            paper: w('Paper', 'Papier', 'Papier', 'Papir', 'Papír', 'الورق', '纸张', '紙張'),
            ink: w('Ink', 'Druckfarbe', 'Encre', 'Blæk', 'Inkoust', 'الحبر', '油墨', '油墨'),
            accent: w('Accent', 'Akzent', 'Accent', 'Accent', 'Akcent', 'لون مميز', '强调色', '強調色'),
          },
          w('Role in the design', 'Rolle im Entwurf', 'Rôle dans le modèle', 'Rolle i designet', 'Úloha v návrhu', 'الدور في التصميم', '在设计中的作用', '在設計中的作用'),
          { nullable: true },
        ),
        name(80),
        col('hex', 'text', w('Colour value', 'Farbwert', 'Valeur de la couleur', 'Farveværdi', 'Hodnota barvy', 'قيمة اللون', '颜色值', '顏色值'), { maxLength: 7, rules: { validation: { minLength: 7, maxLength: 7 } } }),
        position,
      ],
    },
    {
      // What costs more ("Your own logo", "Engrave both sides"). The app's paid rows name it by its code; the price is the app's.
      ref: 'features',
      keyField: 'name',
      unique: [['app', 'code']],
      ...both(W.feature, w('Priced features', 'Aufpreis-Optionen', 'Options payantes', 'Tilvalg med pris', 'Placené volby', 'الميزات بسعر', '加价选项', '加價選項')),
      columns: [pk, app, col('code', 'text', W.code, { maxLength: 40 }), name(), col('active', 'bool', W.active, { default: true })],
    },
    {
      /*
       * A customer's design, kept as data: what it starts from and what they
       * chose, never a picture. Its `code` is what the app's order line looks
       * it up by; its private link is mailed, never shown. A design nobody
       * ordered goes 90 days after its last change, with its files.
       */
      ref: 'designs',
      ...both(w('Customer’s design', 'Entwurf eines Kunden', 'Création d’un client', 'Kundes design', 'Návrh zákazníka', 'تصميم العميل', '顾客的设计', '顧客的設計'), w('Customers’ designs', 'Entwürfe der Kunden', 'Créations des clients', 'Kunders design', 'Návrhy zákazníků', 'تصاميم العملاء', '顾客的设计', '顧客的設計')),
      columns: [
        pk,
        app,
        col('code', 'text', w('Design code', 'Entwurfscode', 'Code de la création', 'Designkode', 'Kód návrhu', 'رمز التصميم', '设计代码', '設計代碼'), { maxLength: 24, unique: true, nullable: true, rules: { code: { length: 16 } } }),
        col('link_token', 'text', w('Private link', 'Privater Link', 'Lien privé', 'Privat link', 'Soukromý odkaz', 'الرابط الخاص', '私人链接', '私人連結'), { maxLength: 16, unique: true, nullable: true, rules: { code: { length: 16, hiddenFromStaff: true } } }),
        col('format', 'int', w('Saved in format', 'Gespeichert im Format', 'Enregistré au format', 'Gemt i format', 'Uloženo ve formátu', 'حُفظ بصيغة', '保存格式', '儲存格式'), { default: 1, rules: { validation: { min: 1, max: 99 } } }),
        link('ready_design_id', 'ready_designs', W.readyDesign),
        link('base_id', 'bases', W.base),
        col('values', 'json', w('What the customer chose', 'Was der Kunde gewählt hat', 'Ce que le client a choisi', 'Hvad kunden valgte', 'Co zákazník zvolil', 'ما اختاره العميل', '顾客的选择', '顧客的選擇'), { nullable: true, rules: { personal: true } }),
        // TODO(J1): `file.upload { kinds, maxBytes }` on both, so a guest's create can carry them. TODO(J10): 'svg' among the kinds.
        col('logo_file', 'text', w('The customer’s logo', 'Logo des Kunden', 'Logo du client', 'Kundens logo', 'Logo zákazníka', 'شعار العميل', '顾客的标志', '顧客的標誌'), { maxLength: 64, nullable: true, rules: { personal: true, file: { accept: ['png', 'jpeg', 'pdf'], maxBytes: CUSTOMER_FILE_BYTES } } }),
        col('photo_file', 'text', w('The customer’s photo', 'Foto des Kunden', 'Photo du client', 'Kundens foto', 'Fotografie zákazníka', 'صورة العميل', '顾客的照片', '顧客的照片'), { maxLength: 64, nullable: true, rules: { personal: true, file: { accept: ['png', 'jpeg', 'pdf'], maxBytes: CUSTOMER_FILE_BYTES } } }),
        choice(
          'state',
          {
            draft: w('Saved', 'Gespeichert', 'Enregistrée', 'Gemt', 'Uloženo', 'محفوظ', '已保存', '已儲存'),
            ordered: w('Ordered', 'Bestellt', 'Commandée', 'Bestilt', 'Objednáno', 'مطلوب', '已下单', '已下單'),
          },
          w('State', 'Status', 'État', 'Status', 'Stav', 'الحالة', '状态', '狀態'),
          { default: 'draft' },
        ),
        col('email', 'text', w('E-mail for the link', 'E-Mail für den Link', 'E-mail pour le lien', 'E-mail til linket', 'E-mail k odkazu', 'البريد الإلكتروني للرابط', '接收链接的电子邮件', '接收連結的電子郵件'), { maxLength: 254, nullable: true, rules: { personal: true, normalize: 'email', validation: { format: 'email' } } }),
        col('created_at', 'timestamptz', w('Saved at', 'Gespeichert am', 'Enregistrée le', 'Gemt den', 'Uloženo', 'حُفظ في', '保存时间', '儲存時間'), { role: 'created_at' }),
        col('last_changed_at', 'timestamptz', w('Last changed', 'Zuletzt geändert', 'Dernière modification', 'Sidst ændret', 'Naposledy změněno', 'آخر تغيير', '最后更改', '最後變更'), { role: 'updated_at' }),
      ],
      expire: { after: 'last_changed_at', days: DESIGN_KEEP_DAYS, unless: { column: 'state', equals: 'ordered' } },
    },
    {
      // The snapshot an order line makes, and the proof the shop sends of it: numbered, never changed by the customer.
      ref: 'design_versions',
      unique: [['design_id', 'version']],
      ...both(w('Design version', 'Entwurfsversion', 'Version de la création', 'Designversion', 'Verze návrhu', 'نسخة التصميم', '设计版本', '設計版本'), w('Design versions', 'Entwurfsversionen', 'Versions des créations', 'Designversioner', 'Verze návrhů', 'نسخ التصميم', '设计版本', '設計版本')),
      columns: [
        pk,
        app,
        link('design_id', 'designs', w('Design', 'Entwurf', 'Création', 'Design', 'Návrh', 'التصميم', '设计', '設計'), false),
        // 1, 2, 3 … per design. A plain number, not a running one: a table a posting writes into carries no number without gaps.
        col('version', 'int', w('Version', 'Version', 'Version', 'Version', 'Verze', 'النسخة', '版本', '版本'), { rules: { validation: { min: 1, max: 999 } } }),
        col('values', 'json', w('What it was made from', 'Woraus sie gemacht wurde', 'Ce à partir de quoi elle est faite', 'Hvad den blev lavet ud fra', 'Z čeho byla vytvořena', 'ما صُنعت منه', '制作依据', '製作依據'), { nullable: true, rules: { personal: true } }),
        col('proof_file', 'text', w('Proof', 'Probedruck', 'Épreuve', 'Korrektur', 'Náhled', 'البروفة', '校样', '校樣'), { maxLength: 64, nullable: true, rules: { file: { accept: ['png', 'jpeg', 'pdf'], maxBytes: 25 * 1024 * 1024 } } }),
        col('note', 'text', w('Note', 'Notiz', 'Note', 'Note', 'Poznámka', 'ملاحظة', '备注', '備註'), { maxLength: 500, nullable: true }),
        col('made_by_id', 'text', w('Made by', 'Erstellt von', 'Faite par', 'Lavet af', 'Vytvořil', 'أنشأها', '制作人', '製作人'), { maxLength: 36, nullable: true, rules: { stamp: { set: 'user-id', on: 'create' } } }),
        col('made_at', 'timestamptz', w('Made at', 'Erstellt am', 'Faite le', 'Lavet den', 'Vytvořeno', 'أُنشئت في', '制作时间', '製作時間'), { role: 'created_at' }),
      ],
    },
  ];
}
