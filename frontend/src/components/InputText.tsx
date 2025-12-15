// src/components/InputText.tsx
import { ChangeEvent } from 'react';

interface InputTextProps {
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  borderColor?: string; // couleur personnalisable
  maxLength?: number; // longueur maximale du texte
}

const InputText = ({
  value,
  onChange,
  placeholder = '',
  borderColor = '#ccc', // couleur par défaut
  maxLength = 50, // longueur maximale par défaut
}: InputTextProps) => {
  return (
    <input
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      maxLength={maxLength}
      className="p-2.5 rounded-[50px] shadow-[0_2px_10px_rgba(0,0,0,0.3)] outline-none"
      style={{
        backgroundColor: "#f9f4ee",
        border: `2.5px solid ${borderColor}`,
      }}
    />
  );
};

export default InputText;
