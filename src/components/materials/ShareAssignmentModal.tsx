import React from 'react';
import { Modal } from '../common/Modal';
import { ShareAssignmentCard } from './ShareAssignmentCard';

interface ShareAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSubject?: string;
  initialAssignmentNumber?: string | number;
}

export const ShareAssignmentModal: React.FC<ShareAssignmentModalProps> = ({
  isOpen,
  onClose,
  initialSubject = '',
  initialAssignmentNumber = '',
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Share Assignment"
      description="Create a WhatsApp message to share with your classmates."
      maxWidth="lg"
    >
      <ShareAssignmentCard
        initialSubject={initialSubject}
        initialAssignmentNumber={initialAssignmentNumber}
        compact
      />
    </Modal>
  );
};
