import { useState } from 'react';
import Modal from '../Modal';
import { useLocale } from '../../i18n';

const OpenInNewTabIcon = ({ to, label }: { to: string; label: string }) => (
  <a
    href={to}
    target="_blank"
    rel="noopener noreferrer"
    onClick={(e) => e.stopPropagation()}
    aria-label={label}
    title={label}
    className="inline-flex shrink-0 text-gray-400 hover:text-black transition-colors"
  >
    <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 4h5v5M16 4l-7 7M14 11v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4" />
    </svg>
  </a>
);

interface MentionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'mentions' | 'privacy';

const tabWrapClass = (active: boolean): string =>
  [
    'flex-1 inline-flex items-center justify-center gap-1.5 border-b-2 transition-colors',
    active ? 'border-black' : 'border-transparent',
  ].join(' ');

const tabClass = (active: boolean): string =>
  [
    'py-3 px-2 text-sm font-bold transition-colors cursor-pointer bg-transparent',
    active ? 'text-black' : 'text-gray-500 hover:text-gray-800',
  ].join(' ');

const MentionsModal = ({ isOpen, onClose }: MentionsModalProps) => {
  const [tab, setTab] = useState<Tab>('mentions');
  const { t } = useLocale();

  const tabs = (
    <div className="flex border-b border-gray-200">
      <div className={tabWrapClass(tab === 'mentions')}>
        <button
          type="button"
          onClick={() => setTab('mentions')}
          className={tabClass(tab === 'mentions')}
        >
          {t.legal.mentions.title}
        </button>
        <OpenInNewTabIcon to="/mentions" label={t.legal.openPage} />
      </div>
      <div className={tabWrapClass(tab === 'privacy')}>
        <button
          type="button"
          onClick={() => setTab('privacy')}
          className={tabClass(tab === 'privacy')}
        >
          {t.legal.privacy.title}
        </button>
        <OpenInNewTabIcon to="/privacy" label={t.legal.openPage} />
      </div>
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
