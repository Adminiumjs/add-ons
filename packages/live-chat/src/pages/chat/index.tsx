/**
 * The module the manifest's page `live-chat` points at: the inbox and Chat
 * settings, with every language of their words.
 */
import type { ReactNode } from 'react';

import { wordsFor } from '../shared/messages.ts';
import { ANSWERS, INBOX, RAIL, SETTINGS, SHARED, THREAD } from '../strings/index.ts';
import { ChatPage } from './ChatPage.tsx';

const t = wordsFor(SHARED, INBOX, THREAD, RAIL, SETTINGS, ANSWERS);

export default function LiveChat(): ReactNode {
  return <ChatPage t={t} />;
}
