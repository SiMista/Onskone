// src/components/Logo.tsx
import React from 'react';
import logoImg from '../assets/logos/logo_slogan.png';

interface LogoProps {
  size?: 'small' | 'large';
}

const Logo: React.FC<LogoProps> = ({ size = 'small' }) => {
  const styles = {
    display: 'block',
    margin: size === 'large' ? '30px auto' : '30px auto',
    width: size === 'large' ? '400px' : '200px',
    height: 'auto',
  };

  return <img src={logoImg} alt="Logo" style={styles} />;
};

export default Logo;