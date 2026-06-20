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

type Tab = 'cgu' | 'mentions' | 'privacy';

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
  const [tab, setTab] = useState<Tab>('cgu');
  const { t } = useLocale();

  const tabDef: { id: Tab; label: string; to: string; title: string }[] = [
    { id: 'cgu', label: t.legal.tabs.cgu, to: '/cgu', title: t.legal.cgu.title },
    { id: 'mentions', label: t.legal.tabs.mentions, to: '/mentions', title: t.legal.mentions.title },
    { id: 'privacy', label: t.legal.tabs.privacy, to: '/privacy', title: t.legal.privacy.title },
  ];

  const tabs = (
    <div className="flex border-b border-gray-200">
      {tabDef.map(({ id, label, to }) => (
        <div key={id} className={tabWrapClass(tab === id)}>
          <button type="button" onClick={() => setTab(id)} className={tabClass(tab === id)}>
            {label}
          </button>
          <OpenInNewTabIcon to={to} label={t.legal.openPage} />
        </div>
      ))}
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={tabDef.find((d) => d.id === tab)?.title ?? t.legal.cgu.title}
      subHeader={tabs}
    >
      <div className="text-gray-700">
        {tab === 'cgu' && (
          <div className="space-y-4">
            {t.legal.cgu.sections.map((section, index) => (
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
                {section.extra && (
                  <p className="mt-2" dangerouslySetInnerHTML={{ __html: section.extra }} />
                )}
              </section>
            ))}
          </div>
        )}

        {tab === 'mentions' && (
          <div className="space-y-4">
            {t.legal.mentions.sections.map((section, index) => (
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
