import Modal from '../Modal';
import { LEGAL_CONTENT } from '../../constants/legal';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PrivacyModal: React.FC<PrivacyModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={LEGAL_CONTENT.privacy.title}
    >
      <div className="text-gray-700 space-y-4">
        {LEGAL_CONTENT.privacy.sections.map((section, index) => (
          <section key={index}>
            <h3 className="font-bold text-lg mb-2">{section.title}</h3>
            <p>{section.content}</p>
            {section.list && (
              <ul className="list-disc list-inside mt-2 space-y-1">
                {section.list.map((item, itemIndex) => (
                  <li key={itemIndex}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </Modal>
  );
};

export default PrivacyModal;
