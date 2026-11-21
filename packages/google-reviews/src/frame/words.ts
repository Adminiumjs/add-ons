/** The box's own words, in the eight languages. It can fetch nothing, so they ride in its one file. */

export interface BoxWords {
  loading: string;
  stars: (rating: string) => string;
  count: (n: string) => string;
  order: string;
  readAll: string;
  reviewUs: string;
  none: string;
  failed: string;
  open: string;
}

export const BOX_WORDS: Readonly<Record<string, BoxWords>> = {
  'en-US': { loading: 'Loading…', stars: (r) => `${r} out of 5 stars`, count: (n) => `${n} reviews`, order: 'Most relevant first, as Google orders them', readAll: 'Read all on Google', reviewUs: 'Review us on Google', none: 'No reviews on Google yet.', failed: 'Google’s reviews could not be loaded.', open: 'See them on Google' },
  'de-DE': { loading: 'Wird geladen…', stars: (r) => `${r} von 5 Sternen`, count: (n) => `${n} Bewertungen`, order: 'Die relevantesten zuerst, wie Google sie ordnet', readAll: 'Alle auf Google lesen', reviewUs: 'Bewerten Sie uns auf Google', none: 'Noch keine Bewertungen auf Google.', failed: 'Die Google-Bewertungen konnten nicht geladen werden.', open: 'Auf Google ansehen' },
  'fr-FR': { loading: 'Chargement…', stars: (r) => `${r} étoiles sur 5`, count: (n) => `${n} avis`, order: 'Les plus pertinents d’abord, dans l’ordre de Google', readAll: 'Tout lire sur Google', reviewUs: 'Donnez-nous votre avis sur Google', none: 'Pas encore d’avis sur Google.', failed: 'Impossible de charger les avis Google.', open: 'Les voir sur Google' },
  'da-DK': { loading: 'Indlæser…', stars: (r) => `${r} ud af 5 stjerner`, count: (n) => `${n} anmeldelser`, order: 'Mest relevante først, som Google sorterer dem', readAll: 'Læs alle på Google', reviewUs: 'Anmeld os på Google', none: 'Ingen anmeldelser på Google endnu.', failed: 'Googles anmeldelser kunne ikke indlæses.', open: 'Se dem på Google' },
  'cs-CZ': { loading: 'Načítání…', stars: (r) => `${r} z 5 hvězdiček`, count: (n) => `Počet recenzí: ${n}`, order: 'Nejrelevantnější první, jak je řadí Google', readAll: 'Přečíst vše na Googlu', reviewUs: 'Ohodnoťte nás na Googlu', none: 'Na Googlu zatím nejsou žádné recenze.', failed: 'Recenze z Googlu se nepodařilo načíst.', open: 'Zobrazit na Googlu' },
  'ar-EG': { loading: 'جارٍ التحميل…', stars: (r) => `${r} من 5 نجوم`, count: (n) => `عدد التقييمات: ${n}`, order: 'الأكثر صلة أولًا، كما يرتبها Google', readAll: 'اقرأ الكل على Google', reviewUs: 'قيّمنا على Google', none: 'لا توجد تقييمات على Google بعد.', failed: 'تعذّر تحميل تقييمات Google.', open: 'شاهدها على Google' },
  'zh-CN': { loading: '正在加载…', stars: (r) => `${r} 星（满分 5 星）`, count: (n) => `${n} 条评价`, order: '最相关的排在前面，按 Google 的排序', readAll: '在 Google 上查看全部', reviewUs: '在 Google 上评价我们', none: 'Google 上还没有评价。', failed: '无法加载 Google 评价。', open: '在 Google 上查看' },
  'zh-TW': { loading: '正在載入…', stars: (r) => `${r} 顆星（滿分 5 顆星）`, count: (n) => `${n} 則評論`, order: '最相關的排在前面，依 Google 的排序', readAll: '在 Google 上查看全部', reviewUs: '在 Google 上評論我們', none: 'Google 上還沒有評論。', failed: '無法載入 Google 評論。', open: '在 Google 上查看' },
};

/** The words for a language tag: the exact one, then the same language, then English. */
export function wordsFor(language: string): BoxWords {
  const base = language.split('-')[0];
  return BOX_WORDS[language] ?? Object.entries(BOX_WORDS).find(([tag]) => tag.split('-')[0] === base)?.[1] ?? BOX_WORDS['en-US']!;
}
