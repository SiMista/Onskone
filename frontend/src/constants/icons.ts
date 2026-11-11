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
 * Contour un peu plus épais, 8 directions (les diagonales évitent les coins entaillés) +
 * ombre portée 35%, pour l'emoji géant du bandeau de catégorie du ThemePickerModal
 * (≥56px), posé sur un dégradé vif où le contour fin de STICKER_FILTER se perdait.
 * Les drop-shadows s'empilent : épaisseur réelle ≈ cardinal + diagonale (0.9 + 0.6 ≈ 1.5px).
 */
export const STICKER_FILTER_HERO =
  'drop-shadow(0.9px 0 0 #000) drop-shadow(-0.9px 0 0 #000) drop-shadow(0 0.9px 0 #000) drop-shadow(0 -0.9px 0 #000) drop-shadow(0.6px 0.6px 0 #000) drop-shadow(-0.6px 0.6px 0 #000) drop-shadow(0.6px -0.6px 0 #000) drop-shadow(-0.6px -0.6px 0 #000) drop-shadow(1px 2px 0 rgba(0,0,0,0.35))';
