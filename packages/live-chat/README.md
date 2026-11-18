# Live chat

A chat window on your website. Your team answers visitors in Adminium, and if
you want them, automatic answers you write reply first.

Adminium serves the window, keeps every conversation and writes every message:
no code of this add-on runs for a visitor, and nothing is fetched from
anywhere else. It needs Adminium 0.3.64 or newer, on a public https address.

## What it keeps

- **Conversations and their messages**, written by Adminium alone. Staff answer
  through Adminium's own chat routes; nobody types a message into a table.
- **Answers**: the questions people ask, other ways they ask them, and the
  answer sent exactly as written, in a version per language. Anyone chatting
  may be shown an answer, so none should hold anything private.
- **The answerer's choices**: for each visitor question it was asked about,
  the answer it picked or the hand-over to a person, with the tokens spent.
- **The chat's settings**: opening hours and "closed until", the welcome line
  and the words outside hours, automatic answers and their daily token limit,
  Milo drafting, who is told, how long conversations are kept (12 months unless
  set) and the window's colours.

## How a website uses it

Chat settings gives one line to paste into a website's pages:

```html
<script src="https://<your Adminium>/x/embed.js" data-adminium-chat="live-chat" async></script>
```

The website must be in Privacy and public pages → Your websites, and the
privacy notice must be set: the window's first line links to it.

An app takes a chat's "Make an enquiry", or a question left outside hours, by
opening one of its tables to the chat in its own manifest (a public entry under
the key `chat`).

## Its screens

One page in the Library, **Live chat**: the inbox (waiting for a person, mine,
all), a conversation with take over, reply, Make an enquiry, close and reopen,
and the visitor's details; and **Chat settings**, with the answers and "Try a
question".

## Roles

- **Chat agent**: reads the chats and answers them, and writes the answers.
- **Chat settings manager**: changes the chat's settings.

It attaches to every app and works with none.
