/**
 * Effets visuels appliqués aux emojis Iconify Fluent Flat du projet.
 *
 * Source unique pour garder la cohérence du style "sticker cartoon" partout.
 * NE PAS recopier ces strings inline — toujours importer depuis ce fichier.
 */

/**
 * Contour noir 4 directions (1px) + ombre portée 35%. L'effet "sticker" qui
 * donne du relief aux emojis Fluent Flat colorés. À appliquer sur les emojis
 * "héros" (≥18px). Ne pas appliquer sur les icônes monochromes (mdi:*, ph:*,
 * lucide:*) — le contour noir n'a pas de sens dessus.
 */
export const STICKER_FILTER =
  'drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) drop-shadow(1px 2px 0 rgba(0,0,0,0.35))';

/**
 * Version renforcée pour les très gros emojis (≥40px) : contour 1.2px côté
 * droit (asymétrie subtile qui donne plus de profondeur) + ombre portée 35%.
 * Utilisé sur les cartes-thèmes du ThemePickerModal.
 */
export const STICKER_FILTER_STRONG =
  'drop-shadow(1.2px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) drop-shadow(1px 2px 0 rgba(0,0,0,0.35))';

/**
 * Contour seul, un peu plus épais, 8 directions (les diagonales évitent les coins
 * entaillés), sans ombre portée, pour l'emoji géant du bandeau de catégorie du
 * ThemePickerModal (≥56px), posé sur un dégradé vif où le contour fin de STICKER_FILTER
 * se perdait.
 * Décalages en pixels ENTIERS obligatoires : en fractionnaire (0.9px, 0.6px), Chrome
 * arrondit les positifs à 0 et les négatifs à -1 sur écran densité 1, et tout le contour
 * s'empilait en haut à gauche (rien en bas à droite, comme une ombre à l'envers).
 * L'épaisseur se dose donc par l'opacité, pas par le décalage : cardinales pleines (1px)
 * + diagonales à 70 % (anneau extérieur adouci) ≈ un peu moins que 2px pleins.
 */
export const STICKER_FILTER_HERO =
  'drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) drop-shadow(1px 1px 0 rgba(0,0,0,0.7)) drop-shadow(-1px 1px 0 rgba(0,0,0,0.7)) drop-shadow(1px -1px 0 rgba(0,0,0,0.7)) drop-shadow(-1px -1px 0 rgba(0,0,0,0.7))';
