// src/components/Logo.tsx
import React from 'react';
import logoSloganImg from '../assets/logos/logo_slogan.png';
import logoImg from '../assets/logos/logo.png';

interface LogoProps {
  size?: 'small' | 'large';
}

const Logo: React.FC<LogoProps> = ({
  size = 'small'
}) => {
  const styles = {
    display: 'block',
    margin: '20px auto 0px auto',
    width: size === 'large' ? '30%' : '20%',
    height: 'auto',
  };
  return <img src={logoSloganImg} alt="Logo" style={styles} />;
};

export default Logo;