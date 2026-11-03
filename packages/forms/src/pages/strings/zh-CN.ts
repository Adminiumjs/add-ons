/** Simplified Chinese strings for the Forms & surveys screens. Keys are those of en-US.ts. */
export const shared: Readonly<Record<string, string>> = {
  "shared.cancel": "取消",
  "shared.close": "关闭",
  "shared.failed.title": "无法加载",
  "shared.loading": "正在加载",
  "shared.missing.backForms": "返回表单",
  "shared.missing.backSurveys": "返回调查",
  "shared.missing.body": "它可能已被删除，或者链接不完全正确。",
  "shared.missing.form": "此表单不在这里",
  "shared.missing.survey": "此调查不在这里",
  "shared.refusal.conflict": "有人同时修改了此内容。未保存任何内容，请重试。",
  "shared.refusal.forbidden": "您无权执行此操作。",
  "shared.refusal.notDraft": "只能删除草稿。已上线的表单请改为关闭。",
  "shared.refusal.notFound": "此内容已不存在。",
  "shared.refusal.off": "表单与调查目前已关闭。",
  "shared.refusal.other": "无法保存，请重试。",
  "shared.refusal.rate": "尝试次数过多，请稍等一分钟。",
  "shared.refusal.slugTaken": "另一个表单已在使用该链接名。",
  "shared.refusal.state": "此表单在此期间已更改。请重新打开以查看当前状态。",
  "shared.refused.body": "如有需要，请联系管理员。",
  "shared.refused.title": "您无权打开此内容",
  "shared.retry": "重试",
  "shared.state.closed": "已关闭",
  "shared.state.draft": "草稿",
  "shared.state.live": "已上线",
  "shared.tab.answers": "回答",
  "shared.tab.invitations": "邀请",
  "shared.tab.questions": "问题",
  "shared.tab.results": "结果",
  "shared.tab.share": "分享",
  "shared.tabs.form": "表单的各部分",
  "shared.tabs.survey": "调查的各部分"
};

export const list: Readonly<Record<string, string>> = {
  "list.answers": "{count, plural, other {# 条回答}}",
  "list.closedOn": "{date} 已关闭",
  "list.column.actions": "操作",
  "list.column.answers": "回答",
  "list.column.languages": "语言",
  "list.column.name": "名称",
  "list.column.status": "状态",
  "list.column.updated": "更新时间",
  "list.delete.body": "“{name}”及其问题将被删除，且无法撤销。",
  "list.delete.confirm": "删除",
  "list.delete.title": "删除此草稿？",
  "list.deleteDraft": "删除草稿",
  "list.deleted": "草稿已删除。",
  "list.empty.forms.body": "创建一个网站访客可以填写的表单。每条回答都可以成为您某个表中的一行。",
  "list.empty.forms.title": "还没有表单",
  "list.empty.surveys.body": "询问客户一项工作完成得如何。规则会在工作完成后发送调查，每条回答都会计入结果。",
  "list.empty.surveys.title": "还没有调查",
  "list.invited": "已邀请 {count} 人",
  "list.more": "显示最近更改的 {count} 个。",
  "list.newForm": "新建表单",
  "list.newSurvey": "新建调查",
  "list.score": "推荐分 {score}",
  "list.tab.forms": "表单",
  "list.tab.surveys": "调查",
  "list.tabs": "表单或调查",
  "list.thanksForm": "谢谢，我们已收到您的回答。",
  "list.thanksSurvey": "谢谢，您的回答对我们很有帮助。",
  "list.title": "表单",
  "list.untitledForm": "未命名表单",
  "list.untitledSurvey": "未命名调查",
  "list.updated": "更新于{since}",
  "list.view": "视图",
  "list.view.cards": "卡片",
  "list.view.list": "列表"
};

export const builder: Readonly<Record<string, string>> = {
  "builder.closeForm": "关闭表单",
  "builder.closeSurvey": "关闭调查",
  "builder.languages": "语言版本",
  "builder.placeholder.questions": "在这里编写此表单的问题。",
  "builder.preview": "预览",
  "builder.publish": "发布",
  "builder.saved": "所有更改已保存",
  "builder.saving": "正在保存"
};

export const answers: Readonly<Record<string, string>> = {
  "answers.placeholder.answers": "每条提交的回答都列在这里。"
};

export const surveys: Readonly<Record<string, string>> = {
  "surveys.placeholder.invitations": "收到此调查的每个人都列在这里。",
  "surveys.placeholder.results": "调查结果在这里统计。"
};

export const share: Readonly<Record<string, string>> = {
  "share.placeholder.share": "链接、二维码和用于您网站的代码行都显示在这里。"
};
