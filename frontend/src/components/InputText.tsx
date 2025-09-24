// src/components/InputText.tsx
import React from 'react';

interface InputTextProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  borderColor?: string; // couleur personnalisable
}

const InputText: React.FC<InputTextProps> = ({
  value,
  onChange,
  placeholder = '',
  borderColor = '#ccc', // couleur par défaut
}) => {
  return (
    <input
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        padding: '10px',
        borderRadius: '50px',
        border: `2px solid ${borderColor}`,
        outline: 'none',
      }}
    />
  );
};

export default InputText;
