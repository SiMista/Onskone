// src/components/InputText.tsx
import React from 'react';

interface InputTextProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  borderColor?: string; // couleur personnalisable
  maxLength?: number; // longueur maximale du texte
}

const InputText: React.FC<InputTextProps> = ({
  value,
  onChange,
  placeholder = '',
  borderColor = '#ccc', // couleur par défaut
  maxLength = 50, // longueur maximale par défaut
}) => {
  return (
    <input
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      maxLength={maxLength}
      className="p-2.5 rounded-[50px] shadow-[0_2px_10px_rgba(0,0,0,0.4)] outline-none"
      style={{
        border: `2.5px solid ${borderColor}`,
      }}
    />
  );
};

export default InputText;
