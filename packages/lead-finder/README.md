# Lead finder

Find companies by what they do and where, fill in a company's details from its
website and the public registers, and, if you switch it on, keep the people who
work there, each told at once where their details came from.

Adminium does the work: it reads a company's website, calls each source with
only that source's key, writes what you add or fill in as you, and sends the
mail that tells a found person. This add-on brings the sources, its tables and
their words. It needs Adminium 0.3.66 or newer, and is installed online only.

## Its sources

| Source | What it gives | Key |
|---|---|---|
| Website reader | A company's details from its own site, read by Adminium | none |
| Companies House (UK) | Companies by SIC code and place; one company by number or name | your Companies House key |
| Register of France | Units by NAF code and place; one unit by SIREN or name | none |
| Register of Norway | Units by SN2025 code and municipality; one unit by number or name | none |
| OpenCorporates | One company's registered details, by number and country or by name | your paid OpenCorporates key |
| Hunter | The people at a company's domain, with their work addresses | your Hunter key |

Each source reaches only its own hosts. France also asks the state's open town
service (`geo.api.gouv.fr`) for a typed town's codes: Paris, Lyon and Marseille
are searched by their arrondissements.

- Companies House data is under the Open Government Licence; the French register
  under the Licence Ouverte (Etalab); the Norwegian register under NLOD
  (Brønnøysundregistrene).
- OpenCorporates: a business needs a paid key, and details found with it may need
  finding again if the subscription ends. Its card says "Powered by OpenCorporates".
- Hunter is used only while Lead finder keeps people. Each look-up counts against
  your Hunter account.

A unit France marks as objecting to sales use, or only partly public, and one
OpenCorporates marks as restricted for marketing, is never added. A sole trader
is a person: with people off, Lead finder keeps limited companies only.

## Its screens

- **Lead finder** (Library): two tabs. *Find companies* searches one source by what
  companies do (the register's own activity list) and where, a page at a time, and
  adds the ticked ones to the companies table your app declares. *People found* lists
  the people kept, whom you may read, whether they may be e-mailed, and where telling
  them stands, with *Send again* for a mail that failed.
- **Lead finder settings** (from the page's *Sources* link): a card per source (its
  hosts, licence, key, Check, daily limit and switch) and the *People* card (the
  switch, why you keep found people in each language needed, how long, and a
  preview of the mail).
- **Fill in details**, on a company's record: reads its website and one register,
  shows what would change, fills in only what you tick, and finds the people who
  work there with Hunter while people are kept.

## What it keeps

- **People found**: for each person stored in your app's people table, where
  they were found, when, the purpose they are kept for, by when they must be told
  and when they were, and the pages Hunter saw their address on. Adminium alone
  writes it.
- **Fields' sources**: for each field a source filled on a record, which source
  and when, with a fingerprint of the value, so the note under the field shows
  only while the value is unchanged. Adminium alone writes it.
- **The tell mail**: the mail that tells a found person why you have their details,
  sent as service mail as soon as they are stored.
- **Its settings**: whether people are kept at all, why you keep them (one plain
  sentence per language), and for how long (3 years unless set).

The activity lists each register searches by are in `src/activities/`, as data:
UK SIC 2007, NAF rév. 2 and SN2025.

## Roles

- **Company finder**: opens the page, reads the people found, the fields' sources
  and the tell mails, and may send a failed tell mail again.
- **Lead finder settings manager**: opens the page and changes Lead finder's settings.

It attaches to every app. Its sample is the CRM's to ship (`seeds/`): the people
Hunter found at the sample companies, in each state.
