import Button from './Button';

interface NotebookInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Déclenché au clic sur le bouton ET à la touche Entrée (sans Shift) si le texte est non vide. */
  onSubmit: () => void;
  placeholder?: string;
  maxLength?: number;
  /** Texte du bouton d'envoi. */
  submitLabel: string;
  /** Désactive la zone de saisie (ex: pendant l'envoi). Défaut false. */
  disabled?: boolean;
  /**
   * Désactive le bouton d'envoi. Si non fourni, le bouton est désactivé tant
   * que le texte (trim) est vide.
   */
  submitDisabled?: boolean;
  /** Place le curseur dans la zone au montage. Défaut true. */
  autoFocus?: boolean;
  /**
   * Joue l'animation de secousse + flash chaud sur la carte (feedback d'envoi
   * d'AnswerPhase). Défaut false.
   */
  shaking?: boolean;
}

/**
 * Zone de saisie "carnet" partagée entre AnswerPhase et SubstituteAnsweringPhase :
 * carte crème cartonnée (texture papier, bordure noire, ombre stack) contenant
 * un textarea transparent, suivie d'un bouton d'envoi vert.
 *
 * Le conteneur prend `flex-1` : l'appelant doit le poser dans un flex-col qui
 * lui réserve la hauteur restante.
 */
const NotebookInput = ({
  value,
  onChange,
  onSubmit,
  placeholder,
  maxLength,
  submitLabel,
  disabled = false,
  submitDisabled,
  autoFocus = true,
  shaking = false,
}: NotebookInputProps) => {
  const isSubmitDisabled = submitDisabled ?? !value.trim();

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div
        className={`
          relative flex-1 flex flex-col min-h-0 rounded-2xl border-[2.5px] border-black stack-shadow
          bg-cream-player texture-paper overflow-hidden
          ${shaking ? 'animate-paper-shake animate-flash-warm' : ''}
        `}
        style={{ transformOrigin: 'center bottom' }}
      >
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={disabled}
          autoFocus={autoFocus}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (value.trim()) onSubmit();
            }
          }}
          enterKeyHint="send"
          className="
            flex-1 w-full bg-transparent resize-none outline-none
            text-gray-900 text-base md:text-lg leading-relaxed
            px-4 md:px-5 py-3 md:py-4 pb-10
            placeholder:text-gray-400
          "
        />
      </div>

      <div className="mt-3 md:mt-4 flex items-center justify-center">
        <Button variant="success" size="lg" onClick={onSubmit} disabled={isSubmitDisabled}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
};

export default NotebookInput;
