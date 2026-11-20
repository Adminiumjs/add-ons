# @adminium/add-on-lead-finder

## 1.0.33

## 1.0.32

### Patch Changes

- dc614f1: A new add-on, Lead finder: find companies by what they do and where, fill in a company's details from its website and the public registers, and keep the people who work there when you switch that on. Six sources: the website reader (Adminium reads the site), Companies House with your key, the registers of France and Norway with no key, OpenCorporates with your paid key (fill-in only), and Hunter with your key (people only). Each source reaches only its own hosts and gets only its own key. The marks France and OpenCorporates put against sales use are honoured, and a sole trader counts as a person. It keeps the people found, each field's source, and the mail that tells a found person where their details came from, all written by Adminium alone. Two roles: Company finder and Lead finder settings manager. Needs Adminium 0.3.66; installed online only, and not listed yet.
- 3d4909f: Lead finder's screens. A Lead finder page in the Library with two tabs: Find companies (pick what they do from the register's own list, where, and which source to search; see what is already here, what a colleague keeps, what asked for no sales contact and who is a sole trader; add the ticked ones to your companies table) and People found (who was kept, whether they may be e-mailed, and whether they were told, with Send again for a mail that failed). Its settings hold a card per source (key, check, daily limit, switch; read only without the settings grant) and the People card (the switch, why you keep found people in each language needed, how long, and a preview of the mail). On a company's record, Fill in details reads its website and a register, shows what would change, asks which company when there are several, fills in only what you tick, and finds the people who work there with Hunter. Hunter is asked at most 15 times a second. In eight languages.
