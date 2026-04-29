// src/components/Logo.tsx
import logoSloganImg from '../assets/logos/logo_slogan.png';

interface LogoProps {
  size?: 'small' | 'large';
}

const Logo = ({
  size = 'small'
}: LogoProps) => {
  // Tailles responsive: plus grand sur mobile, plus petit sur desktop
  const sizeClasses = size === 'large'
    ? 'w-[60%] md:w-72'
    : 'w-[45%] md:w-56';

  return (
    <img
      src={logoSloganImg}
      alt="Logo"
      className={`block mt-3 md:mt-5 mb-1.5 mx-auto h-auto ${sizeClasses}`}
    />
  );
};

export default Logo;