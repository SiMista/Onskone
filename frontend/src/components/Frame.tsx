// src/components/Frame.tsx
import React from 'react';

interface FrameProps {
  width?: string;   // ex: "300px" ou "80%"
  children: React.ReactNode;
  textAlign?: 'left' | 'center' | 'right';
}

const Frame: React.FC<FrameProps> = ({
  width = '100%',
  children,
  textAlign = "center"
}) => {
  return (
    <div
      style={{
        width,
        backgroundColor: 'white',
        padding: '20px 40px',
        boxSizing: 'border-box',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
        margin: '20px auto',
        display: 'flex',           // <- active Flexbox
        flexDirection: 'column',   // <- empile verticalement
        alignItems: 'center',      // <- centre horizontalement
        textAlign: textAlign,       // <- centre le texte à l'intérieur
        gap: '15px',               // <- espace entre les éléments
      }}
    > {children} </div>
  );
};

export default Frame;
