import { Icon as IconifyIcon } from '@iconify/react';
import type { IconProps } from '@iconify/react';

/**
 * <Icon> d'Iconify, rendu dès le premier rendu. Sans `ssr`, Iconify rend une <span> vide,
 * attend son montage (useEffect, donc APRÈS le paint) puis se re-rend avec le SVG : même
 * embarqués (utils/iconPreload.ts), les emojis arrivaient une frame trop tard (saut de mise
 * en page, pop au milieu des anims d'ouverture). Avec `ssr`, une icône déjà en mémoire sort
 * tout de suite ; une icône absente (jeux non embarqués : mdi, ph…) se charge comme avant.
 *
 * Toujours importer <Icon> d'ici, jamais de '@iconify/react' (garde-fou : Icon.test.ts).
 */
export const Icon = (props: IconProps) => <IconifyIcon ssr {...props} />;

export default Icon;
