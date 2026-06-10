import { Catalog } from './gallery/Catalog';
import { Simulators } from './gallery/Simulators';

// =====================================================================
// Galerie de composants (DEV only) - inspecteur live du design system.
// Découpée en deux familles :
//   - <Catalog>     composants statiques affichés tels quels (boutons, inputs…)
//   - <Simulators>  démos pilotées par du state (toasts, modales, ShareCard…)
// =====================================================================

export const Gallery = () => (
  <div className="p-6 max-w-[1400px] mx-auto flex flex-col gap-6">
    <div className="flex flex-col gap-1">
      <h1 className="font-display text-3xl text-white tracking-tight">
        Galerie <span className="text-amber-300">/ composants</span>
      </h1>
      <p className="font-mono text-[11px] text-white/45">
        Aperçu live des éléments d'interface - utilise-le pour vérifier la cohérence visuelle avant un commit.
      </p>
    </div>

    <Catalog />
    <Simulators />
  </div>
);
