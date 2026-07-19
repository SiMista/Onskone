import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import Button from '../components/Button';
import Footer from '../components/Footer';
import LanguageSwitcher from '../components/LanguageSwitcher';
import ReportTrigger from '../components/ReportTrigger';
import { useLocale } from '../i18n';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import type { Locale } from '@onskone/shared';

// Pages publiques (URL accessibles hors app) requises par les stores :
// /privacy et /mentions affichent le meme contenu que la modale MentionsModal.
interface LegalProps {
  kind: 'privacy' | 'mentions' | 'cgu' | 'support';
}

// Descriptions SEO courtes par page + langue. Locales ici (et non dans le dico
// i18n) : chaque page légale doit annoncer un contenu distinct au moteur pour
// ne plus être vue comme un doublon de l'accueil.
const LEGAL_DESCRIPTIONS: Record<LegalProps['kind'], Record<Locale, string>> = {
  privacy: {
    fr: "Politique de confidentialité d'Onskoné : quelles données de jeu sont collectées, comment elles sont utilisées et conservées.",
    en: "Onskoné's privacy policy: what game data is collected, how it is used and how long it is kept.",
  },
  mentions: {
    fr: 'Mentions légales du jeu Onskoné : éditeur, hébergement, propriété intellectuelle et responsabilité.',
    en: 'Legal notice for the Onskoné game: publisher, hosting, intellectual property and liability.',
  },
  cgu: {
    fr: "Conditions générales d'utilisation d'Onskoné : règles d'usage du jeu, contenu utilisateur et responsabilités.",
    en: "Onskoné's terms of use: rules for using the game, user content and responsibilities.",
  },
  support: {
    fr: 'Aide et support Onskoné : signaler un bug, poser une question ou nous contacter.',
    en: 'Onskoné help and support: report a bug, ask a question or get in touch.',
  },
};

const Legal = ({ kind }: LegalProps) => {
  const navigate = useNavigate();
  const { t, locale } = useLocale();
  const section = t.legal[kind];
  useDocumentMeta({
    title: `${section.title} - Onskoné?`,
    description: LEGAL_DESCRIPTIONS[kind][locale] ?? LEGAL_DESCRIPTIONS[kind].fr,
    canonicalPath: `/${kind}`,
    robots: 'index, follow',
  });

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 w-full max-w-screen-md mx-auto px-4 py-4 flex flex-col overflow-y-auto overscroll-contain no-scrollbar safe-pt">
        <div className="flex items-center justify-between gap-3 mb-4">
          <button type="button" onClick={() => navigate('/')} className="bg-transparent cursor-pointer">
            <Logo size="small" />
          </button>
          <LanguageSwitcher />
        </div>

        <div className="bg-white rounded-[28px] border-[3px] border-black texture-paper stack-shadow-lg p-5 md:p-7 mb-4">
          <h1 className="marker-highlight text-lg md:text-xl font-display font-bold text-gray-900 tracking-tight mb-5">{section.title}</h1>
          <div className="space-y-5 text-gray-800">
            {section.sections.map((s, i) => (
              <section key={i}>
                <h2 className="font-bold text-lg mb-2">{s.title}</h2>
                <p className="m-0" dangerouslySetInnerHTML={{ __html: s.content }} />
                {s.list && (
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    {s.list.map((item, j) => (
                      <li key={j}>{item}</li>
                    ))}
                  </ul>
                )}
                {s.extra && <p className="mt-2 m-0" dangerouslySetInnerHTML={{ __html: s.extra }} />}
              </section>
            ))}
          </div>

          {kind === 'support' && (
            <div className="mt-6 flex justify-center">
              <ReportTrigger variant="footer" label={t.report.title} className="!text-gray-700 hover:!text-black" />
            </div>
          )}
        </div>

        <div className="flex justify-center pb-2">
          <Button text={t.notFound.backHome} variant="primary" size="md" onClick={() => navigate('/')} />
        </div>
      </div>

      <div className="shrink-0">
        <Footer />
      </div>
    </div>
  );
};

export default Legal;
