import { ReactNode } from "react";

type ButtonVariant = "primary" | "success" | "danger" | "warning" | "secondary" | "ghost";
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

const variantStyles: Record<ButtonVariant, { base: string; hover: string }> = {
  primary: { base: "bg-[#1AAFDA] text-black", hover: "hover:bg-[#3fbedf]" },
  success: { base: "bg-[#30c94d] text-black", hover: "hover:bg-[#4ad766]" },
  danger: { base: "bg-[#ff5757] text-black", hover: "hover:bg-[#ff7373]" },
  warning: { base: "bg-[#FFC700] text-black", hover: "hover:bg-[#ffd633]" },
  secondary: { base: "bg-white/90 text-black", hover: "hover:bg-white" },
  ghost: { base: "bg-transparent text-gray-700", hover: "hover:bg-black/5 hover:text-black" },
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

  const classes = [
    "relative font-display font-bold tracking-tight uppercase",
    "rounded-xl",
    isGhost ? "" : "border-[2.5px] border-black",
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
    // Press effect : la carte s'enfonce dans son ombre
    !isDisabled && !isGhost ? "active:translate-x-[2px] active:translate-y-[2px] active:[box-shadow:1px_1px_0_0_rgba(0,0,0,0.85)]" : "",
    "transition-all duration-150 ease-out",
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
      {content}
    </button>
  );
};

export default Button;
