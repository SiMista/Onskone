// src/components/InputText.tsx
import { ChangeEvent, KeyboardEvent } from 'react';

interface InputTextProps {
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  borderColor?: string; // couleur personnalisable
  maxLength?: number; // longueur maximale du texte
  onSubmit?: () => void; // appelé quand l'utilisateur appuie sur Entrée
}

const InputText = ({
  value,
  onChange,
  placeholder = '',
  borderColor = '#ccc', // couleur par défaut
  maxLength = 50, // longueur maximale par défaut
  onSubmit,
}: InputTextProps) => {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };
  return (
    <input
      type="text"
      value={value}
      onChange={onChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      maxLength={maxLength}
      enterKeyHint="go"
      className="p-2.5 rounded-[50px] shadow-[0_2px_10px_rgba(0,0,0,0.3)] outline-none"
      style={{
        backgroundColor: "#f9f4ee",
        border: `2.5px solid ${borderColor}`,
      }}
    />
  );
};

export default InputText;
