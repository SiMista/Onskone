import { useState, type MouseEvent } from 'react';
import { Capacitor } from '@capacitor/core';
import Modal from '../Modal';
import { useLocale } from '../../i18n';

type Tab = 'cgu' | 'mentions' | 'privacy';

interface MentionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Onglet ouvert d'entrée (ex. 'privacy' depuis le paywall). Défaut : CGU. */
  initialTab?: Tab;
}

const tabClass = (active: boolean): string =>
  [
    'flex-1 py-3 px-2 text-sm font-bold border-b-2 transition-colors cursor-pointer bg-transparent',
    active ? 'text-black border-black' : 'text-gray-500 border-transparent hover:text-gray-800',
  ].join(' ');

// Lien « page complète » réservé au web : en natif, `target="_blank"` sur un
// chemin relatif n'ouvre rien, et le contenu est déjà entier dans la modale.
const isNative = Capacitor.isNativePlatform();

const MentionsModal = ({ isOpen, onClose, initialTab = 'cgu' }: MentionsModalProps) => {
  const [tab, setTab] = useState<Tab>(initialTab);
  const { t } = useLocale();

  const tabDef: { id: Tab; label: string; to: string; title: string }[] = [
    { id: 'cgu', label: t.legal.tabs.cgu, to: '/cgu', title: t.legal.cgu.title },
    { id: 'mentions', label: t.legal.tabs.mentions, to: '/mentions', title: t.legal.mentions.title },
    { id: 'privacy', label: t.legal.tabs.privacy, to: '/privacy', title: t.legal.privacy.title },
  ];

  const tabs = (
    <div className="flex border-b border-gray-200">
      {tabDef.map(({ id, label }) => (
        <button key={id} type="button" onClick={() => setTab(id)} className={tabClass(tab === id)}>
          {label}
        </button>
      ))}
    </div>
  );

  // Liens internes du texte légal (« /privacy » dans les CGU, « /cgu » dans les
  // mentions) : on bascule d'onglet au lieu de naviguer. En natif, suivre le lien
  // rechargeait la WebView hors de la partie en cours.
  const onContentClick = (e: MouseEvent<HTMLDivElement>) => {
    const href = (e.target as HTMLElement).closest('a')?.getAttribute('href');
    const target = tabDef.find((d) => d.to === href);
    if (!target) return;
    e.preventDefault();
    setTab(target.id);
  };

  const currentPath = tabDef.find((d) => d.id === tab)?.to ?? '/cgu';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={tabDef.find((d) => d.id === tab)?.title ?? t.legal.cgu.title}
      subHeader={tabs}
    >
      <div className="text-gray-700" onClick={onContentClick}>
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

        {!isNative && (
          <a
            href={currentPath}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-6 text-sm font-semibold text-gray-500 underline underline-offset-2 hover:text-black"
          >
            {t.legal.openPage} ↗
          </a>
        )}
      </div>
    </Modal>
  );
};

export default MentionsModal;
