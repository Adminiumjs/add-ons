/** Arabic strings for the Forms & surveys screens. Keys are those of en-US.ts. */
export const shared: Readonly<Record<string, string>> = {
  "shared.cancel": "إلغاء",
  "shared.close": "إغلاق",
  "shared.failed.title": "تعذّر التحميل",
  "shared.loading": "جارٍ التحميل",
  "shared.missing.backForms": "العودة إلى النماذج",
  "shared.missing.backSurveys": "العودة إلى الاستطلاعات",
  "shared.missing.body": "ربما حُذف، أو أن الرابط غير صحيح تمامًا.",
  "shared.missing.form": "هذا النموذج غير موجود هنا",
  "shared.missing.survey": "هذا الاستطلاع غير موجود هنا",
  "shared.refusal.conflict": "غيّر شخص آخر هذا في الوقت نفسه. لم يُحفظ شيء. حاول مرة أخرى.",
  "shared.refusal.forbidden": "ليس لديك إذن للقيام بذلك.",
  "shared.refusal.notDraft": "لا يمكن حذف إلا المسودة. أغلق النموذج المنشور بدلًا من ذلك.",
  "shared.refusal.notFound": "لم يعد هذا موجودًا.",
  "shared.refusal.off": "النماذج والاستطلاعات متوقفة الآن.",
  "shared.refusal.other": "تعذّر الحفظ. حاول مرة أخرى.",
  "shared.refusal.rate": "محاولات كثيرة جدًا. انتظر دقيقة.",
  "shared.refusal.slugTaken": "يستخدم نموذج آخر اسم الرابط هذا بالفعل.",
  "shared.refusal.state": "تغيّر هذا النموذج في الأثناء. افتحه مرة أخرى لترى حالته.",
  "shared.refused.body": "اطلب ذلك من مديرك إن احتجت إليه.",
  "shared.refused.title": "ليس لديك إذن لفتح هذا",
  "shared.retry": "حاول مرة أخرى",
  "shared.state.closed": "مغلق",
  "shared.state.draft": "مسودة",
  "shared.state.live": "منشور",
  "shared.tab.answers": "الإجابات",
  "shared.tab.invitations": "الدعوات",
  "shared.tab.questions": "الأسئلة",
  "shared.tab.results": "النتائج",
  "shared.tab.share": "المشاركة",
  "shared.tabs.form": "أجزاء النموذج",
  "shared.tabs.survey": "أجزاء الاستطلاع"
};

export const list: Readonly<Record<string, string>> = {
  "list.answers": "{count, plural, zero {لا إجابات} one {إجابة واحدة} two {إجابتان} few {# إجابات} many {# إجابة} other {# إجابة}}",
  "list.closedOn": "أُغلق في {date}",
  "list.column.actions": "الإجراءات",
  "list.column.answers": "الإجابات",
  "list.column.languages": "اللغات",
  "list.column.name": "الاسم",
  "list.column.status": "الحالة",
  "list.column.updated": "آخر تعديل",
  "list.delete.body": "سيُحذف «{name}» وأسئلته. لا يمكن التراجع عن ذلك.",
  "list.delete.confirm": "حذف",
  "list.delete.title": "حذف هذه المسودة؟",
  "list.deleteDraft": "حذف المسودة",
  "list.deleted": "حُذفت المسودة.",
  "list.empty.forms.body": "أنشئ نموذجًا يملؤه زوار موقعك. يمكن أن تصبح كل إجابة صفًا في أحد جداولك.",
  "list.empty.forms.title": "لا توجد نماذج بعد",
  "list.empty.surveys.body": "اسأل عملاءك كيف سار العمل. ترسل قاعدةٌ الاستطلاعَ بعد العمل، وتُحتسب كل إجابة في نتائجه.",
  "list.empty.surveys.title": "لا توجد استطلاعات بعد",
  "list.invited": "تمت دعوة {count}",
  "list.more": "يُعرض آخر {count} تم تعديلها.",
  "list.newForm": "نموذج جديد",
  "list.newSurvey": "استطلاع جديد",
  "list.score": "درجة التوصية {score}",
  "list.tab.forms": "النماذج",
  "list.tab.surveys": "الاستطلاعات",
  "list.tabs": "النماذج أو الاستطلاعات",
  "list.thanksForm": "شكرًا لك. وصلتنا إجاباتك.",
  "list.thanksSurvey": "شكرًا لك. إجاباتك تساعدنا.",
  "list.title": "النماذج",
  "list.untitledForm": "نموذج بلا عنوان",
  "list.untitledSurvey": "استطلاع بلا عنوان",
  "list.updated": "عُدّل {since}",
  "list.view": "العرض",
  "list.view.cards": "بطاقات",
  "list.view.list": "قائمة"
};

export const builder: Readonly<Record<string, string>> = {
  "builder.closeForm": "إغلاق النموذج",
  "builder.closeSurvey": "إغلاق الاستطلاع",
  "builder.languages": "نسخ اللغات",
  "builder.placeholder.questions": "تُبنى أسئلة هذا النموذج هنا.",
  "builder.preview": "معاينة",
  "builder.publish": "نشر",
  "builder.saved": "تم حفظ كل التغييرات",
  "builder.saving": "جارٍ الحفظ"
};

export const answers: Readonly<Record<string, string>> = {
  "answers.placeholder.answers": "تُعرض هنا كل إجابة مُرسلة."
};

export const surveys: Readonly<Record<string, string>> = {
  "surveys.placeholder.invitations": "يُعرض هنا كل من أُرسل إليه الاستطلاع.",
  "surveys.placeholder.results": "تُحتسب نتائج الاستطلاع هنا."
};

export const share: Readonly<Record<string, string>> = {
  "share.placeholder.share": "يظهر هنا الرابط ورمز QR والسطران الخاصان بموقعك."
};
