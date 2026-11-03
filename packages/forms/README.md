# Forms & surveys

Forms your website visitors fill in, and surveys you send your customers after
a job. Each answer can become a row in one of your tables, or simply be kept.

Adminium draws every form a visitor sees, checks every answer and keeps it:
no code of this add-on runs for a visitor, and nothing is fetched from
anywhere else.

## What it keeps

- **Forms and surveys**: the questions in up to eight languages, what an answer
  becomes, who is told, the limits, and the version visitors are shown, frozen
  when it is published.
- **Answers**, written by Adminium alone. Staff read them and delete them;
  nobody types one in.
- **Files** a visitor sent with an answer, opened by staff only.
- **Invitations** to a survey, each mailed with a link of its own for the
  Surveys purpose, and the mails themselves.
- **How long answers are kept**: 24 months unless the owner sets another time.

## How an app uses it

An app opens one of its tables to forms in its own manifest (a public entry
under the key `forms`), naming the columns an answer may fill. The builder
lists only those tables. A survey is sent by an automation rule's step, which
writes an invitation; Adminium mails it.

## Its screens

One page in the Library, **Forms**: the forms and the surveys as cards or as a
list, and each one's questions, share tab and answers or results. A generated
page holds how long answers are kept.

It attaches to every app and works with none: a form can keep its answers
without becoming a row anywhere.
