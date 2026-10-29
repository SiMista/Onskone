import Logo from './Logo';

interface ScreenLogoProps {
  /** Classe z-index du wrapper (varie selon l'écran : z-0 par défaut, z-20 sur EndGame). */
  z?: string;
  /** Dans le flux (réserve sa hauteur) au lieu d'absolu : pour un écran dont le contenu
      peut occuper toute la hauteur et passerait sinon sous le logo (EndGame). */
  inFlow?: boolean;
}

/* Logo desktop uniquement - positionné absolu pour ne pas perturber le centrage vertical.
   tablet: (pas md:) pour l'exclure des téléphones en paysage (largeur >768px mais hauteur basse). */
const ScreenLogo = ({ z = 'z-0', inFlow = false }: ScreenLogoProps) => (
  <div className={`hidden tablet:flex ${inFlow ? 'relative shrink-0 w-full' : 'absolute top-0 left-0 right-0'} justify-center pointer-events-none ${z}`}>
    <Logo size="small" />
  </div>
);

export default ScreenLogo;
