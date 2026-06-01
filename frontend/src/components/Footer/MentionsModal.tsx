import { useState } from 'react';
import Modal from '../Modal';
import { useLocale } from '../../i18n';

interface MentionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'mentions' | 'privacy';

const tabClass = (active: boolean): string =>
  [
    'flex-1 py-3 px-3 text-sm font-bold transition-colors border-b-2 cursor-pointer bg-transparent',
    active
      ? 'border-black text-black'
      : 'border-transparent text-gray-500 hover:text-gray-800',
  ].join(' ');

const MentionsModal = ({ isOpen, onClose }: MentionsModalProps) => {
  const [tab, setTab] = useState<Tab>('mentions');
  const { t } = useLocale();

  const tabs = (
    <div className="flex border-b border-gray-200">
      <button
        type="button"
        onClick={() => setTab('mentions')}
        className={tabClass(tab === 'mentions')}
      >
        {t.legal.mentions.title}
      </button>
      <button
        type="button"
        onClick={() => setTab('privacy')}
        className={tabClass(tab === 'privacy')}
      >
        {t.legal.privacy.title}
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={tab === 'mentions' ? t.legal.mentions.title : t.legal.privacy.title}
      subHeader={tabs}
    >
      <div className="text-gray-700">
        {tab === 'mentions' && (
          <div className="space-y-4">
            {t.legal.mentions.sections.map((section, index) => (
              <section key={index}>
                <h3 className="font-bold text-lg mb-2">{section.title}</h3>
                <p dangerouslySetInnerHTML={{ __html: section.content }} />
                {section.extra && (
                  <p className="mt-2" dangerouslySetInnerHTML={{ __html: section.extra }} />
                )}
              </section>
            ))}
          </div>
        )}

        {tab === 'privacy' && (
          <div className="space-y-4">
            {t.legal.privacy.sections.map((section, index) => (
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
        )}
      </div>
    </Modal>
  );
};

export default MentionsModal;
