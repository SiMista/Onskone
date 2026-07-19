// Badges de téléchargement "officiels" (reproduction maison en SVG inline) :
// bouton noir arrondi + logo Apple/Google + "Download on the / Get it on" + nom du store.
// SVG inline pour respecter la CSP du projet (aucun asset externe).

interface StoreBadgeProps {
  store: 'apple' | 'google';
  href: string;
  className?: string;
  ariaLabel?: string;
}

// Ratio ~ celui des badges officiels (largeur ~3.35x la hauteur).
const StoreBadge = ({ store, href, className, ariaLabel }: StoreBadgeProps) => {
  const label = store === 'apple' ? "Télécharger dans l'App Store" : 'Disponible sur Google Play';
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel ?? label}
      className={`flex min-w-0 ${className ?? ''}`}
    >
      {store === 'apple' ? <AppleBadge /> : <GoogleBadge />}
    </a>
  );
};

// --- App Store ---------------------------------------------------------------
const AppleBadge = () => (
  <svg viewBox="0 0 120 40" role="img" aria-hidden className="w-full h-auto block" xmlns="http://www.w3.org/2000/svg">
    <rect x="0.5" y="0.5" width="119" height="39" rx="6.5" fill="#000" stroke="#A6A6A6" />
    {/* Logo Apple */}
    <path
      fill="#fff"
      d="M24.77 20.3c-.02-2.05 1.68-3.04 1.75-3.09-.96-1.4-2.44-1.59-2.97-1.61-1.26-.13-2.46.74-3.1.74-.64 0-1.63-.72-2.68-.7-1.38.02-2.65.8-3.36 2.03-1.43 2.49-.37 6.17 1.02 8.19.68 1 1.49 2.11 2.55 2.07 1.02-.04 1.41-.66 2.65-.66 1.23 0 1.58.66 2.66.64 1.1-.02 1.79-1.01 2.46-2.01.78-1.15 1.1-2.27 1.12-2.33-.02-.01-2.15-.82-2.17-3.27zm-2.04-6.02c.56-.68.94-1.63.84-2.57-.81.03-1.79.54-2.37 1.22-.52.6-.98 1.56-.85 2.48.9.07 1.82-.46 2.38-1.13z"
    />
    {/* Textes (libellé officiel FR) */}
    <text x="34" y="16" fill="#fff" fontFamily="Helvetica, Arial, sans-serif" fontSize="6.5">Télécharger dans l'</text>
    <text x="34" y="30" fill="#fff" fontFamily="Helvetica, Arial, sans-serif" fontSize="15" fontWeight="600">App Store</text>
  </svg>
);

// --- Google Play -------------------------------------------------------------
const GoogleBadge = () => (
  <svg viewBox="0 0 135 40" role="img" aria-hidden className="w-full h-auto block" xmlns="http://www.w3.org/2000/svg">
    <rect x="0.5" y="0.5" width="134" height="39" rx="6.5" fill="#000" stroke="#A6A6A6" />
    {/* Logo Google Play : triangle "play" (▶) pavé en 4 facettes autour du
        centre C. Sommets : A=(0,0) haut-gauche, B=(0,20) bas-gauche,
        P=(19,10) pointe. C=(6,10). Milieux des bords droits : MH=(9.5,5), MB=(9.5,15). */}
    <g transform="translate(15 10)">
      {/* Bleu : bord supérieur (A - MH - C) */}
      <path d="M0 0 L9.5 5 L6 10 Z" fill="#00E1FF" />
      {/* Vert : corps gauche (A - C - B) */}
      <path d="M0 0 L6 10 L0 20 Z" fill="#00F076" />
      {/* Rouge : bord inférieur (B - C - MB) */}
      <path d="M0 20 L6 10 L9.5 15 Z" fill="#FF4133" />
      {/* Jaune : pointe (MH - P - MB - C) */}
      <path d="M9.5 5 L19 10 L9.5 15 L6 10 Z" fill="#FFCE00" />
    </g>
    {/* Textes (libellé officiel FR) */}
    <text x="42" y="16" fill="#fff" fontFamily="Helvetica, Arial, sans-serif" fontSize="6" letterSpacing="0.5">DISPONIBLE SUR</text>
    <text x="42" y="30" fill="#fff" fontFamily="Helvetica, Arial, sans-serif" fontSize="14" fontWeight="600">Google Play</text>
  </svg>
);

export default StoreBadge;
