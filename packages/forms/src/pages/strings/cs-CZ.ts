/** Czech strings for the Forms & surveys screens. Keys are those of en-US.ts. */
export const shared: Readonly<Record<string, string>> = {
  "shared.cancel": "Zrušit",
  "shared.close": "Zavřít",
  "shared.failed.title": "Nepodařilo se načíst",
  "shared.loading": "Načítá se",
  "shared.missing.backForms": "Zpět na formuláře",
  "shared.missing.backSurveys": "Zpět na průzkumy",
  "shared.missing.body": "Možná byl smazán, nebo odkaz není úplně správný.",
  "shared.missing.form": "Tento formulář tu není",
  "shared.missing.survey": "Tento průzkum tu není",
  "shared.refusal.conflict": "Někdo jiný to ve stejnou chvíli změnil. Nic se neuložilo. Zkuste to znovu.",
  "shared.refusal.forbidden": "K tomu nemáte oprávnění.",
  "shared.refusal.notDraft": "Smazat lze jen koncept. Zveřejněný formulář místo toho uzavřete.",
  "shared.refusal.notFound": "Toto už neexistuje.",
  "shared.refusal.off": "Formuláře a průzkumy jsou teď vypnuté.",
  "shared.refusal.other": "Nepodařilo se uložit. Zkuste to znovu.",
  "shared.refusal.rate": "Příliš mnoho pokusů. Počkejte minutu.",
  "shared.refusal.slugTaken": "Tento název odkazu už používá jiný formulář.",
  "shared.refusal.state": "Formulář se mezitím změnil. Otevřete ho znovu a uvidíte, jak na tom je.",
  "shared.refused.body": "Pokud to potřebujete, požádejte vedoucího.",
  "shared.refused.title": "Toto nemáte oprávnění otevřít",
  "shared.retry": "Zkusit znovu",
  "shared.state.closed": "Uzavřený",
  "shared.state.draft": "Koncept",
  "shared.state.live": "Zveřejněný",
  "shared.tab.answers": "Odpovědi",
  "shared.tab.invitations": "Pozvánky",
  "shared.tab.questions": "Otázky",
  "shared.tab.results": "Výsledky",
  "shared.tab.share": "Sdílet",
  "shared.tabs.form": "Části formuláře",
  "shared.tabs.survey": "Části průzkumu"
};

export const list: Readonly<Record<string, string>> = {
  "list.answers": "{count, plural, one {# odpověď} few {# odpovědi} other {# odpovědí}}",
  "list.closedOn": "Uzavřeno {date}",
  "list.column.actions": "Akce",
  "list.column.answers": "Odpovědi",
  "list.column.languages": "Jazyky",
  "list.column.name": "Název",
  "list.column.status": "Stav",
  "list.column.updated": "Upraveno",
  "list.delete.body": "„{name}“ a jeho otázky budou smazány. Tuto akci nelze vrátit.",
  "list.delete.confirm": "Smazat",
  "list.delete.title": "Smazat tento koncept?",
  "list.deleteDraft": "Smazat koncept",
  "list.deleted": "Koncept byl smazán.",
  "list.empty.forms.body": "Vytvořte formulář, který mohou vyplnit návštěvníci vašeho webu. Každá odpověď se může stát řádkem v jedné z vašich tabulek.",
  "list.empty.forms.title": "Zatím žádné formuláře",
  "list.empty.surveys.body": "Zeptejte se zákazníků, jak zakázka proběhla. Pravidlo pošle průzkum po zakázce a každá odpověď se započítá do výsledků.",
  "list.empty.surveys.title": "Zatím žádné průzkumy",
  "list.invited": "Pozváno: {count}",
  "list.more": "Zobrazeno {count} naposledy změněných.",
  "list.newForm": "Nový formulář",
  "list.newSurvey": "Nový průzkum",
  "list.score": "skóre doporučení {score}",
  "list.tab.forms": "Formuláře",
  "list.tab.surveys": "Průzkumy",
  "list.tabs": "Formuláře nebo průzkumy",
  "list.thanksForm": "Děkujeme. Vaše odpovědi máme.",
  "list.thanksSurvey": "Děkujeme. Vaše odpovědi nám pomáhají.",
  "list.title": "Formuláře",
  "list.untitledForm": "Formulář bez názvu",
  "list.untitledSurvey": "Průzkum bez názvu",
  "list.updated": "Upraveno {since}",
  "list.view": "Zobrazení",
  "list.view.cards": "Karty",
  "list.view.list": "Seznam"
};

export const builder: Readonly<Record<string, string>> = {
  "builder.closeForm": "Uzavřít formulář",
  "builder.closeSurvey": "Uzavřít průzkum",
  "builder.languages": "Jazykové verze",
  "builder.placeholder.questions": "Zde se sestavují otázky tohoto formuláře.",
  "builder.preview": "Náhled",
  "builder.publish": "Zveřejnit",
  "builder.saved": "Všechny změny uloženy",
  "builder.saving": "Ukládá se"
};

export const answers: Readonly<Record<string, string>> = {
  "answers.placeholder.answers": "Zde je uvedena každá odeslaná odpověď."
};

export const surveys: Readonly<Record<string, string>> = {
  "surveys.placeholder.invitations": "Zde je uveden každý, komu byl průzkum poslán.",
  "surveys.placeholder.results": "Zde se sčítají výsledky průzkumu."
};

export const share: Readonly<Record<string, string>> = {
  "share.placeholder.share": "Zde se zobrazí odkaz, QR kód a řádky na váš web."
};
