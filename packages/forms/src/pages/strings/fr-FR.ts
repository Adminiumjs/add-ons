/** French strings for the Forms & surveys screens. Keys are those of en-US.ts. */
export const shared: Readonly<Record<string, string>> = {
  "shared.cancel": "Annuler",
  "shared.close": "Fermer",
  "shared.failed.title": "Impossible de charger ceci",
  "shared.loading": "Chargement",
  "shared.missing.backForms": "Retour aux formulaires",
  "shared.missing.backSurveys": "Retour aux enquêtes",
  "shared.missing.body": "Il a peut-être été supprimé, ou le lien n’est pas tout à fait juste.",
  "shared.missing.form": "Ce formulaire n’est pas ici",
  "shared.missing.survey": "Cette enquête n’est pas ici",
  "shared.refusal.conflict": "Quelqu’un d’autre a modifié ceci en même temps. Rien n’a été enregistré. Réessayez.",
  "shared.refusal.forbidden": "Vous n’avez pas le droit de faire ceci.",
  "shared.refusal.notDraft": "Seul un brouillon peut être supprimé. Fermez plutôt un formulaire en ligne.",
  "shared.refusal.notFound": "Ceci n’existe plus.",
  "shared.refusal.off": "Formulaires et enquêtes est désactivé pour le moment.",
  "shared.refusal.other": "Impossible d’enregistrer ceci. Réessayez.",
  "shared.refusal.rate": "Trop d’essais. Attendez une minute.",
  "shared.refusal.slugTaken": "Un autre formulaire utilise déjà ce nom de lien.",
  "shared.refusal.state": "Ce formulaire a changé entre-temps. Rouvrez-le pour voir où il en est.",
  "shared.refused.body": "Demandez à un responsable si vous en avez besoin.",
  "shared.refused.title": "Vous n’avez pas le droit d’ouvrir ceci",
  "shared.retry": "Réessayer",
  "shared.state.closed": "Fermé",
  "shared.state.draft": "Brouillon",
  "shared.state.live": "En ligne",
  "shared.tab.answers": "Réponses",
  "shared.tab.invitations": "Invités",
  "shared.tab.questions": "Les questions",
  "shared.tab.results": "Résultats",
  "shared.tab.share": "Partager",
  "shared.tabs.form": "Parties du formulaire",
  "shared.tabs.survey": "Parties de l’enquête"
};

export const list: Readonly<Record<string, string>> = {
  "list.answers": "{count, plural, one {# réponse} other {# réponses}}",
  "list.closedOn": "Fermée le {date}",
  "list.column.actions": "Actions",
  "list.column.answers": "Réponses",
  "list.column.languages": "Langues",
  "list.column.name": "Nom",
  "list.column.status": "Statut",
  "list.column.updated": "Modifié",
  "list.delete.body": "« {name} » et ses questions sont supprimés. Cette action est irréversible.",
  "list.delete.confirm": "Supprimer",
  "list.delete.title": "Supprimer ce brouillon ?",
  "list.deleteDraft": "Supprimer le brouillon",
  "list.deleted": "Brouillon supprimé.",
  "list.empty.forms.body": "Créez un formulaire que les visiteurs de votre site peuvent remplir. Chaque réponse peut devenir une ligne de l’une de vos tables.",
  "list.empty.forms.title": "Aucun formulaire pour l’instant",
  "list.empty.surveys.body": "Demandez à vos clients comment s’est passé un chantier. Une règle envoie l’enquête après le chantier, et chaque réponse est comptée dans ses résultats.",
  "list.empty.surveys.title": "Aucune enquête pour l’instant",
  "list.invited": "{count} invités",
  "list.more": "Affichage des {count} modifiés le plus récemment.",
  "list.newForm": "Nouveau formulaire",
  "list.newSurvey": "Nouvelle enquête",
  "list.score": "score de recommandation {score}",
  "list.tab.forms": "Formulaires",
  "list.tab.surveys": "Enquêtes",
  "list.tabs": "Formulaires ou enquêtes",
  "list.thanksForm": "Merci. Nous avons bien reçu vos réponses.",
  "list.thanksSurvey": "Merci. Vos réponses nous aident.",
  "list.title": "Formulaires",
  "list.untitledForm": "Formulaire sans titre",
  "list.untitledSurvey": "Enquête sans titre",
  "list.updated": "Modifié {since}",
  "list.view": "Affichage",
  "list.view.cards": "Cartes",
  "list.view.list": "Liste"
};

export const builder: Readonly<Record<string, string>> = {
  "builder.closeForm": "Fermer le formulaire",
  "builder.closeSurvey": "Fermer l’enquête",
  "builder.languages": "Versions linguistiques",
  "builder.placeholder.questions": "Les questions de ce formulaire se construisent ici.",
  "builder.preview": "Aperçu",
  "builder.publish": "Publier",
  "builder.saved": "Toutes les modifications sont enregistrées",
  "builder.saving": "Enregistrement"
};

export const answers: Readonly<Record<string, string>> = {
  "answers.placeholder.answers": "Chaque réponse envoyée est listée ici."
};

export const surveys: Readonly<Record<string, string>> = {
  "surveys.placeholder.invitations": "Toutes les personnes à qui l’enquête a été envoyée sont listées ici.",
  "surveys.placeholder.results": "Les résultats de l’enquête sont comptés ici."
};

export const share: Readonly<Record<string, string>> = {
  "share.placeholder.share": "Le lien, le code QR et les lignes pour votre site s’affichent ici."
};
