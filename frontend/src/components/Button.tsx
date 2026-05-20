import { ReactNode } from "react";

type ButtonVariant = "primary" | "success" | "danger" | "warning" | "secondary" | "ghost" | "quit";
type ButtonSize = "sm" | "md" | "lg" | "xl";

type ButtonProps = {
  children?: ReactNode;
  text?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  isLoading?: boolean;
  isFullWidth?: boolean;
  icon?: ReactNode;
  iconOnly?: boolean;
  rotateEffect?: boolean;
  hero?: boolean;
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit" | "reset";
};

// Couleurs sourcées depuis les tokens @theme (cf. index.css). Le "band" (bandeau
// sous le bouton qui s'écrase au press) est volontairement plus sombre que le hover.
const variantStyles: Record<ButtonVariant, { base: string; hover: string; band: string | null }> = {
  primary: { base: "bg-brand-500 text-black", hover: "hover:bg-[#3fbedf]", band: "#1389ad" },
  success: { base: "bg-success-500 text-black", hover: "hover:bg-success-400", band: "var(--color-success-700)" },
  danger: { base: "bg-danger-500 text-black", hover: "hover:bg-danger-400", band: "var(--color-danger-700)" },
  warning: { base: "bg-warning-500 text-black", hover: "hover:bg-warning-400", band: "var(--color-warning-700)" },
  secondary: { base: "bg-white/90 text-black", hover: "hover:bg-white", band: "#cfcfcf" },
  ghost: { base: "bg-transparent text-gray-700", hover: "hover:bg-black/5 hover:text-black", band: null },
  quit: { base: "bg-quit text-black", hover: "hover:bg-quit-hover", band: "#6b7280" },
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3.5 py-1 text-sm",
  md: "px-5 py-2 text-base",
  lg: "px-7 py-2.5 text-lg",
  xl: "px-9 py-3 text-xl",
};

const Button: React.FC<ButtonProps> = ({
  children,
  text,
  variant = "primary",
  size = "md",
  disabled = false,
  isLoading = false,
  isFullWidth = false,
  icon,
  iconOnly = false,
  rotateEffect = false,
  hero = false,
  onClick,
  className = "",
  type = "button",
}) => {
  const isDisabled = disabled || isLoading;
  const isGhost = variant === "ghost";

  // Press feedback : le bouton ne bouge pas, on supprime juste sa stack-shadow
  // (les "ombres-cartes" empilées qui lui donnent son relief). Effet visuel :
  // le bouton s'aplatit contre la page comme un sticker pressé. Au relâchement,
  // la transition fait revenir le relief tranquillement.
  const pressClasses = isDisabled || isGhost
    ? ""
    : hero
      ? "active:[box-shadow:none!important] active:translate-x-[3px] active:translate-y-[3px]"
      : "active:[box-shadow:none!important] active:translate-x-[2px] active:translate-y-[2px]";

  const band = variantStyles[variant].band;
  const classes = [
    "group relative font-display font-bold tracking-tight uppercase select-none",
    "rounded-xl",
    isGhost ? "" : "border-[2.5px] border-black overflow-hidden",
    isGhost ? "" : "texture-paper",
    isFullWidth ? "w-full" : "",
    isGhost ? "" : (hero ? "stack-shadow" : "stack-shadow-sm"),
    iconOnly ? "p-2" : sizeStyles[size],
    variantStyles[variant].base,
    !isDisabled ? variantStyles[variant].hover : "",
    isDisabled ? "cursor-not-allowed opacity-55 grayscale-[40%]" : "cursor-pointer",
    // Hero : sticker-style (rotation au repos qui se redresse au hover, scale up)
    hero && !isDisabled ? "rotate-[-1.5deg] hover:rotate-0 hover:scale-[1.06]" : "",
    // RotateEffect : micro-interaction existante (pour boutons non-hero)
    rotateEffect && !hero && !isDisabled ? "hover:scale-[1.06] hover:rotate-[-1.2deg]" : "",
    // Lift par défaut si aucun effet spécial
    !rotateEffect && !hero && !isDisabled && !isGhost ? "hover:-translate-y-0.5" : "",
    pressClasses,
    "transition-all duration-[350ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
    className,
  ].filter(Boolean).join(" ");

  const content = isLoading ? (
    <span className="inline-flex items-center gap-2">
      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      Chargement...
    </span>
  ) : (
    <>
      {icon && <span className={iconOnly ? "" : "mr-2"}>{icon}</span>}
      {!iconOnly && (children || text)}
    </>
  );

  return (
    <button
      type={type}
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      className={classes}
    >
      {band && (
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-[10%] origin-bottom pointer-events-none transition-transform duration-200 ease-out group-active:scale-y-0"
          style={{ backgroundColor: band }}
        />
      )}
      <span className="relative z-10">{content}</span>
    </button>
  );
};

export default Button;
