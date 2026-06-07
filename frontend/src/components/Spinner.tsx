/**
 * Spinner SVG circulaire en rotation (`animate-spin`). Hérite la couleur via
 * `currentColor` et la taille via `className` (défaut h-4 w-4). Mutualisé entre
 * Button (état isLoading) et ShareSection (partage en cours).
 */
const Spinner = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" aria-hidden>
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

export default Spinner;
