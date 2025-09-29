// src/components/InputText.tsx
import React from 'react';

interface InputTextProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  borderColor?: string; // couleur personnalisable
  maxlength?: string; // longueur maximale du texte
}

const InputText: React.FC<InputTextProps> = ({
  value,
  onChange,
  placeholder = '',
  borderColor = '#ccc', // couleur par défaut
  maxlength = "50", // longueur maximale par défaut
}) => {
  return (
    <input
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      maxLength={parseInt(maxlength)} // appliquer la longueur maximale
      style={{
        padding: '10px',
        borderRadius: '50px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
        border: `2.5px solid ${borderColor}`,
        outline: 'none',
      }}
    />
  );
};

export default InputText;
