import Modal from '../Modal';
import { useLocale } from '../../i18n';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AboutModal = ({ isOpen, onClose }: AboutModalProps) => {
  const { t } = useLocale();
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.legal.about.title}
    >
      <div className="text-gray-700 space-y-6">
        {t.legal.about.sections.map((section, index) => (
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
        <p className="text-xs text-gray-400 text-center pt-4 border-t border-gray-200">
          {t.footer.versionLabel} {__APP_VERSION__}
        </p>
      </div>
    </Modal>
  );
};

export default AboutModal;
