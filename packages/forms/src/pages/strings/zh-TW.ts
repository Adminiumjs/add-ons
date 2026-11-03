/** Traditional Chinese strings for the Forms & surveys screens. Keys are those of en-US.ts. */
export const shared: Readonly<Record<string, string>> = {
  "shared.cancel": "取消",
  "shared.close": "關閉",
  "shared.failed.title": "無法載入",
  "shared.loading": "載入中",
  "shared.missing.backForms": "返回表單",
  "shared.missing.backSurveys": "返回調查",
  "shared.missing.body": "它可能已被刪除，或連結不完全正確。",
  "shared.missing.form": "此表單不在這裡",
  "shared.missing.survey": "此調查不在這裡",
  "shared.refusal.conflict": "有人同時修改了此內容。未儲存任何內容，請再試一次。",
  "shared.refusal.forbidden": "您無權執行此操作。",
  "shared.refusal.notDraft": "只能刪除草稿。已上線的表單請改為關閉。",
  "shared.refusal.notFound": "此內容已不存在。",
  "shared.refusal.off": "表單與調查目前已關閉。",
  "shared.refusal.other": "無法儲存，請再試一次。",
  "shared.refusal.rate": "嘗試次數過多，請稍候一分鐘。",
  "shared.refusal.slugTaken": "另一個表單已在使用該連結名稱。",
  "shared.refusal.state": "此表單在此期間已變更。請重新開啟以查看目前狀態。",
  "shared.refused.body": "如有需要，請聯絡管理員。",
  "shared.refused.title": "您無權開啟此內容",
  "shared.retry": "重試",
  "shared.state.closed": "已關閉",
  "shared.state.draft": "草稿",
  "shared.state.live": "已上線",
  "shared.tab.answers": "回答",
  "shared.tab.invitations": "邀請",
  "shared.tab.questions": "問題",
  "shared.tab.results": "結果",
  "shared.tab.share": "分享",
  "shared.tabs.form": "表單的各部分",
  "shared.tabs.survey": "調查的各部分"
};

export const list: Readonly<Record<string, string>> = {
  "list.answers": "{count, plural, other {# 則回答}}",
  "list.closedOn": "{date} 已關閉",
  "list.column.actions": "操作",
  "list.column.answers": "回答",
  "list.column.languages": "語言",
  "list.column.name": "名稱",
  "list.column.status": "狀態",
  "list.column.updated": "更新時間",
  "list.delete.body": "「{name}」及其問題將被刪除，且無法復原。",
  "list.delete.confirm": "刪除",
  "list.delete.title": "刪除此草稿？",
  "list.deleteDraft": "刪除草稿",
  "list.deleted": "草稿已刪除。",
  "list.empty.forms.body": "建立一個網站訪客可以填寫的表單。每則回答都可以成為您某個表中的一列。",
  "list.empty.forms.title": "還沒有表單",
  "list.empty.surveys.body": "詢問客戶一項工作完成得如何。規則會在工作完成後傳送調查，每則回答都會計入結果。",
  "list.empty.surveys.title": "還沒有調查",
  "list.invited": "已邀請 {count} 人",
  "list.more": "顯示最近變更的 {count} 個。",
  "list.newForm": "新增表單",
  "list.newSurvey": "新增調查",
  "list.score": "推薦分數 {score}",
  "list.tab.forms": "表單",
  "list.tab.surveys": "調查",
  "list.tabs": "表單或調查",
  "list.thanksForm": "謝謝，我們已收到您的回答。",
  "list.thanksSurvey": "謝謝，您的回答對我們很有幫助。",
  "list.title": "表單",
  "list.untitledForm": "未命名表單",
  "list.untitledSurvey": "未命名調查",
  "list.updated": "更新於{since}",
  "list.view": "檢視",
  "list.view.cards": "卡片",
  "list.view.list": "清單"
};

export const builder: Readonly<Record<string, string>> = {
  "builder.closeForm": "關閉表單",
  "builder.closeSurvey": "關閉調查",
  "builder.languages": "語言版本",
  "builder.placeholder.questions": "在這裡編寫此表單的問題。",
  "builder.preview": "預覽",
  "builder.publish": "發布",
  "builder.saved": "所有變更已儲存",
  "builder.saving": "儲存中"
};

export const answers: Readonly<Record<string, string>> = {
  "answers.placeholder.answers": "每則提交的回答都列在這裡。"
};

export const surveys: Readonly<Record<string, string>> = {
  "surveys.placeholder.invitations": "收到此調查的每個人都列在這裡。",
  "surveys.placeholder.results": "調查結果在這裡統計。"
};

export const share: Readonly<Record<string, string>> = {
  "share.placeholder.share": "連結、QR 碼和用於您網站的程式碼行都顯示在這裡。"
};
