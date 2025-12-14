// src/components/Logo.tsx
import React from 'react';
import logoSloganImg from '../assets/logos/logo_slogan.png';

interface LogoProps {
  size?: 'small' | 'large';
}

const Logo: React.FC<LogoProps> = ({
  size = 'small'
}) => {
  // Tailles responsive: plus grand sur mobile, plus petit sur desktop
  const sizeClasses = size === 'large'
    ? 'w-[60%] md:w-[25%]'  // Large: 60% mobile, 25% desktop
    : 'w-[45%] md:w-[18%]'; // Small: 45% mobile, 18% desktop

  return (
    <img
      src={logoSloganImg}
      alt="Logo"
      className={`block mt-3 md:mt-5 mb-1.5 mx-auto h-auto ${sizeClasses}`}
    />
  );
};

export default Logo;