// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Leaving the editor with unsaved changes: the confirm-modal anatomy
 * reading *Discard unsaved changes?* with *Keep editing* / *Discard*.
 * Undrawn in the comp, which autosaves and so never has anything to
 * discard; an addition that the explicit-save model forces.
 */
import { TriangleAlert } from 'lucide-react';
import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from '@adminium/ui';

import { t } from '../../messages.js';

export interface DiscardChangesModalProps {
  name: string;
  onKeep: () => void;
  onDiscard: () => void;
}

export function DiscardChangesModal({ name, onKeep, onDiscard }: DiscardChangesModalProps) {
  return (
    <Modal
      open
      size="sm"
      onOpenChange={(open) => {
        if (!open) onKeep();
      }}
    >
      <ModalHeader
        icon={<TriangleAlert />}
        tone="warn"
        title={t('editor.discard.title', 'Discard unsaved changes?')}
        closeLabel={t('common.close', 'Close')}
      />
      <ModalBody>
        <p data-testid="invoices-discard-body" className="text-body-sm text-fg-muted">
          {t('editor.discard.body', 'Your edits to {name} will be lost.', { name })}
        </p>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onKeep} data-testid="invoices-discard-keep">
          {t('editor.discard.keep', 'Keep editing')}
        </Button>
        <Button variant="destructive" onClick={onDiscard} data-testid="invoices-discard-confirm">
          {t('editor.discard.confirm', 'Discard')}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
