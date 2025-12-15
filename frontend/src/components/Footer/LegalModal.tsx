import Modal from '../Modal';
import { LEGAL_CONTENT } from '../../constants/legal';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LegalModal: React.FC<LegalModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={LEGAL_CONTENT.mentions.title}
    >
      <div className="text-gray-700 space-y-4">
        {LEGAL_CONTENT.mentions.sections.map((section, index) => (
          <section key={index}>
            <h3 className="font-bold text-lg mb-2">{section.title}</h3>
            <p>{section.content}</p>
            {section.extra && (
              <p
                className="mt-2"
                dangerouslySetInnerHTML={{ __html: section.extra }}
              />
            )}
          </section>
        ))}
      </div>
    </Modal>
  );
};

export default LegalModal;
