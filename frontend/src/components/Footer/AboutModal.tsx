import Modal from '../Modal';
import { LEGAL_CONTENT } from '../../constants/legal';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AboutSection {
  title: string;
  content: string;
  list?: string[];
}

const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={LEGAL_CONTENT.about.title}
    >
      <div className="text-gray-700 space-y-6">
        {(LEGAL_CONTENT.about.sections as AboutSection[]).map((section, index) => (
          <section key={index}>
            <h3 className="font-bold text-lg mb-2">{section.title}</h3>
            <p dangerouslySetInnerHTML={{ __html: section.content }} />
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

export default AboutModal;