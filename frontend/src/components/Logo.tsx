// src/components/Logo.tsx
import type { Locale } from '@onskone/shared';
import { useLocale } from '../i18n';
import logoSloganFr from '../assets/logos/logo-slogan-fr.png';
import logoSloganEn from '../assets/logos/logo-slogan-en.png';

// Logo avec slogan par langue ; repli sur le FR pour toute locale sans variante.
const LOGO_BY_LOCALE: Record<Locale, string> = {
  fr: logoSloganFr,
  en: logoSloganEn,
};

interface LogoProps {
  size?: 'small' | 'large';
}

const Logo = ({
  size = 'small'
}: LogoProps) => {
  const { locale } = useLocale();
  const logoSloganImg = LOGO_BY_LOCALE[locale] ?? logoSloganFr;
  // Tailles responsive: plus grand sur mobile, plus petit sur desktop.
  // max-h en dvh cape la hauteur sur PC court (large mais peu haut) avec
  // un plancher px pour ne pas devenir illisible sur écran très court.
  const sizeClasses = size === 'large'
    ? 'w-[60%] md:w-72 max-h-[max(70px,14dvh)] md:max-h-[max(80px,16dvh)]'
    : 'w-[45%] md:w-56 max-h-[max(50px,10dvh)] md:max-h-[max(60px,12dvh)]';

  return (
    <img
      src={logoSloganImg}
      alt="Logo"
      className={`block my-3 md:my-5 desktop-short:my-2 mx-auto h-auto object-contain ${sizeClasses}`}
    />
  );
};

export default Logo;