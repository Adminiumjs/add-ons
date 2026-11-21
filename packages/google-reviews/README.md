# Google reviews

Shows up to five of a business's Google reviews, with its rating and how many
it has, on the app's own pages. They are loaded **from Google, in the visitor's
browser, when the visitor presses "See our Google reviews"**. Adminium fetches
none of them and stores none of them.

The business brings its own Place ID and its own Google Maps browser key, in
its own Google Cloud project. Google bills that project.

## Where Google's script runs

Never in an app's page. An app's page holds a guest's session, and its policy
allows only its own host. Google's script runs in **a small page of this
add-on**, which Adminium serves at `/x/add-on-frame/google-reviews` (the
manifest's `addOn.framedPage`):

- the page's own policy **sandboxes it however it is opened**, so it has no
  origin, no access to the app's storage or session, and no reach into the page
  around it;
- it may reach only the Google hosts its manifest names;
- only this Adminium and the business's listed websites may frame it;
- its address carries no token.

There is no slot and no change to the app page's policy. **Until the visitor
presses the button there is no frame, so nothing loads from Google.**

## What an app does

An app that attaches this add-on reads its own row of `places` through its
customer key (`google_reviews_places`, signed out too). A row is served only
once its owner has said the key is restricted. The row says where the box shows
(`on_booking`, `on_reviews`, `on_site`).

The app draws the button. On a press it makes the frame and speaks to it:

```html
<iframe src="/x/add-on-frame/google-reviews"
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        referrerpolicy="strict-origin-when-cross-origin"
        title="Google reviews"></iframe>
```

| From | Message | |
|---|---|---|
| the box | `{channel: "adminium-google-reviews", event: "ready"}` | Answer it with `show` |
| the app | `{channel, event: "show", placeId, browserKey, language, reviewLink?, dark?}` | Taken once |
| the box | `{channel, event: "height", px}` | At most 2,400 |
| the box | `{channel, event: "failed"}` | The box already says so itself |

Check `event.source === frame.contentWindow` on everything the box sends, and
send with target `"*"`: a sandboxed page has no origin to name.

## Setting it up

The screen **Google reviews** walks through it:

1. Find the Place ID with Google's Place ID Finder.
2. Make a browser key with **Maps JavaScript API** and **Places API (New)** on.
3. Under **Website restrictions**, add the one address the screen shows. The box
   always loads from your Adminium address, even when it is shown on your own
   website.
4. Under **API restrictions**, allow only those two APIs.
5. In Google Cloud, **set a daily request quota and a budget alert**. A key in a
   web page can be copied and a referrer can be forged outside a browser, so the
   restriction limits honest pages and the cap limits the bill. Google's list
   charges from about 1,000 loads a month, at about $25 per 1,000.
6. Tick "I've restricted the key", press **Test it**, and save.

## Not proved yet

**A sandboxed page has no origin, so a browser sends it no `Referer`.** Google
checks a key with website restrictions against the page's address, so such a
key may be refused here. Whether Google's script gets past this needs a real
restricted key, and it is walked by hand before release. Until then, treat the
website restriction in step 3 as unproved.

## Building it

```bash
npm run build   # dist/frame.js, dist/pages/settings.js
npm test
```
