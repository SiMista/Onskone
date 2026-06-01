import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import Logo from '../components/Logo';
import Frame from '../components/Frame';
import Button from '../components/Button';
import Footer from '../components/Footer';
import { useLocale } from '../i18n';
import { STICKER_FILTER } from '../constants/icons';

const NotFound = () => {
  const navigate = useNavigate();
  const { t } = useLocale();

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 w-full max-w-screen-md mx-auto px-4 py-4 md:py-4 flex flex-col justify-center overflow-y-auto overscroll-contain no-scrollbar safe-pt">
        <div className="flex justify-center mb-4 md:mb-8">
          <Logo size="large" />
        </div>

        <Frame>
          <div
            className="font-display text-7xl md:text-9xl leading-none text-primary animate-step-drop"
            style={{ animationDelay: '100ms' }}
          >
            <span className="inline-block -rotate-6">4</span>
            <span className="inline-block rotate-3 mx-1">0</span>
            <span className="inline-block -rotate-3">4</span>
          </div>

          <div
            className="flex items-center justify-center gap-2 animate-step-drop"
            style={{ animationDelay: '320ms' }}
          >
            <Icon icon="fluent-emoji-flat:thinking-face" width={32} height={32} aria-hidden style={{ filter: STICKER_FILTER }} />
            <h2 className="text-xl md:text-2xl font-display m-0">{t.notFound.title}</h2>
          </div>

          <p
            className="text-base md:text-lg text-gray-700 max-w-md animate-step-drop"
            style={{ animationDelay: '500ms' }}
          >
            {t.notFound.body}
          </p>

          <div
            className="pt-2 animate-step-drop"
            style={{ animationDelay: '700ms' }}
          >
            <Button
              text={t.notFound.backHome}
              variant="primary"
              size="lg"
              hero
              onClick={() => navigate('/')}
            />
          </div>
        </Frame>
      </div>

      <div className="shrink-0">
        <Footer />
      </div>
    </div>
  );
};

export default NotFound;
