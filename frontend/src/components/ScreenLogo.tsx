import Logo from './Logo';

interface ScreenLogoProps {
  /** Classe z-index du wrapper (varie selon l'écran : z-0 par défaut, z-20 sur EndGame). */
  z?: string;
}

/* Logo desktop uniquement - positionné absolu pour ne pas perturber le centrage vertical.
   tablet: (pas md:) pour l'exclure des téléphones en paysage (largeur >768px mais hauteur basse). */
const ScreenLogo = ({ z = 'z-0' }: ScreenLogoProps) => (
  <div className={`hidden tablet:flex absolute top-0 left-0 right-0 justify-center pointer-events-none ${z}`}>
    <Logo size="small" />
  </div>
);

export default ScreenLogo;
