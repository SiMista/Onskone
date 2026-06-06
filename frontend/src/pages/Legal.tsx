import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import Button from '../components/Button';
import Footer from '../components/Footer';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useLocale } from '../i18n';

// Pages publiques (URL accessibles hors app) requises par les stores :
// /privacy et /mentions affichent le meme contenu que la modale MentionsModal.
interface LegalProps {
  kind: 'privacy' | 'mentions';
}

const Legal = ({ kind }: LegalProps) => {
  const navigate = useNavigate();
  const { t } = useLocale();
  const section = t.legal[kind];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 w-full max-w-screen-md mx-auto px-4 py-4 flex flex-col overflow-y-auto overscroll-contain no-scrollbar safe-pt">
        <div className="flex items-center justify-between gap-3 mb-4">
          <button type="button" onClick={() => navigate('/')} className="bg-transparent cursor-pointer">
            <Logo size="small" />
          </button>
          <LanguageSwitcher />
        </div>

        <div className="bg-cream-paper rounded-2xl border-[2.5px] border-black stack-shadow-sm p-5 md:p-7 mb-4">
          <h1 className="text-display-lg mb-5">{section.title}</h1>
          <div className="space-y-5 text-gray-700">
            {section.sections.map((s, i) => (
              <section key={i}>
                <h2 className="text-display-sm mb-2">{s.title}</h2>
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
