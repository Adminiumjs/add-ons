/**
 * The module the manifest's page `customiser` points at: a product's
 * customising set-up, with every language of its words.
 */
import type { ReactNode } from 'react';

import { CustomerEditorPreview } from '../designs/customerPreview.tsx';
import { showCustomerEditor } from '../designs/preview.tsx';
import { wordsFor } from '../shared/messages.ts';
import { DESIGNS, SETUP, SHARED } from '../strings/index.ts';
import { SetupPage } from '../setup/SetupPage.tsx';

const t = wordsFor(SHARED, SETUP, DESIGNS);

// "Preview as a customer" and step 6 open the customer's own editor, which this page carries.
showCustomerEditor(CustomerEditorPreview);

export default function Customiser(): ReactNode {
  return <SetupPage t={t} />;
}
