/**
 * THE SANDBOXED PAGE'S ONE SCRIPT.
 *
 * It says it is ready, takes one message from the page that framed it (the
 * place and the key), loads Google's Maps JavaScript API with that key, asks
 * once for this place, and draws the answer. Reloading the frame is the only
 * way to ask again. Nothing is kept: the answer lives in this page's memory.
 */
import { drawFailed, drawLoading, drawPlace, prepare, type PlaceAnswer } from './box.ts';
import { CHANNEL, readShow, type BoxMessage, type ShowMessage } from './protocol.ts';
import { wordsFor } from './words.ts';

const FIELDS = ['displayName', 'rating', 'userRatingCount', 'googleMapsURI', 'reviews'];

interface MapsWindow {
  google?: { maps?: { importLibrary?: (name: string) => Promise<unknown> } };
  gm_authFailure?: () => void;
  __adminiumMapsLoaded?: () => void;
}
interface PlacesLibrary {
  Place: new (options: { id: string; requestedLanguage?: string }) => { fetchFields(options: { fields: string[] }): Promise<unknown> } & PlaceAnswer;
}

const say = (message: BoxMessage): void => window.parent.postMessage(message, '*');

function reportHeight(): void {
  say({ channel: CHANNEL, event: 'height', px: document.documentElement.scrollHeight });
}

function loadMaps(key: string, language: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const w = window as unknown as MapsWindow;
    w.__adminiumMapsLoaded = () => resolve();
    const script = document.createElement('script');
    const query = new URLSearchParams({ key, v: 'weekly', loading: 'async', language, callback: '__adminiumMapsLoaded' });
    script.src = `https://maps.googleapis.com/maps/api/js?${query.toString()}`;
    script.async = true;
    script.onerror = () => reject(new Error('the script did not load'));
    document.head.append(script);
  });
}

async function show(message: ShowMessage): Promise<void> {
  const words = wordsFor(message.language);
  prepare(document, message.language, message.dark === true);
  drawLoading(document, words);
  new ResizeObserver(reportHeight).observe(document.documentElement);
  reportHeight();
  const fail = (): void => {
    drawFailed(document, words, message.placeId);
    say({ channel: CHANNEL, event: 'failed' });
    reportHeight();
  };
  // Google calls this when it refuses the key: a wrong key, or a page the key is not restricted to.
  (window as unknown as MapsWindow).gm_authFailure = fail;
  try {
    await loadMaps(message.browserKey, message.language);
    const maps = (window as unknown as MapsWindow).google?.maps;
    if (maps?.importLibrary === undefined) throw new Error('no Maps library');
    const { Place } = (await maps.importLibrary('places')) as PlacesLibrary;
    const place = new Place({ id: message.placeId, requestedLanguage: message.language });
    await place.fetchFields({ fields: FIELDS });
    drawPlace(document, place, words, { placeId: message.placeId, language: message.language, reviewLink: message.reviewLink });
    reportHeight();
  } catch {
    fail();
  }
}

let asked = false;
window.addEventListener('message', (event) => {
  // One question per page: a second message, or one from any other window, is ignored.
  if (asked || event.source !== window.parent) return;
  const message = readShow(event.data);
  if (message === null) return;
  asked = true;
  void show(message);
});
say({ channel: CHANNEL, event: 'ready' });
