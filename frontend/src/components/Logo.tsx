// src/components/Logo.tsx
import React from 'react';
import logoSloganImg from '../assets/logos/logo_slogan.png';

interface LogoProps {
  size?: 'small' | 'large';
}

const Logo: React.FC<LogoProps> = ({
  size = 'small'
}) => {
  return (
    <img
      src={logoSloganImg}
      alt="Logo"
      className={`block mt-5 mb-1.5 mx-auto h-auto ${size === 'large' ? 'w-[25%]' : 'w-[18%]'}`}
    />
  );
};

export default Logo;