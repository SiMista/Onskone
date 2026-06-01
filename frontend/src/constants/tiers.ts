/**
 * Métadonnées structurelles du tier (palier de score). Le titre + messages
 * vivent dans le dictionnaire i18n (t.endGame.tiers) - même index, même ordre.
 */
export interface Tier {
  max: number;
  midPct: number;
  color: string;
  icon: string;
  emoji: string;
}

export const TIERS: Tier[] = [
  { max: 20, midPct: 10, color: '#ff4f4f', icon: 'fluent-emoji-flat:neutral-face', emoji: '😐' },
  { max: 40, midPct: 30, color: '#ff8c3a', icon: 'fluent-emoji-flat:eyes', emoji: '👀' },
  { max: 60, midPct: 50, color: '#ffc700', icon: 'fluent-emoji-flat:handshake', emoji: '🤝' },
  { max: 80, midPct: 70, color: '#8bd94d', icon: 'fluent-emoji-flat:sparkles', emoji: '✨' },
  { max: 99, midPct: 90, color: '#30c94d', icon: 'fluent-emoji-flat:people-hugging', emoji: '🫂' },
  { max: 100, midPct: 100, color: '#b46cff', icon: 'fluent-emoji-flat:partying-face', emoji: '🥳' },
];

export const ONSKONE_INDEX = TIERS.length - 1;
export const PUBLIC_TIERS = TIERS.slice(0, ONSKONE_INDEX);
