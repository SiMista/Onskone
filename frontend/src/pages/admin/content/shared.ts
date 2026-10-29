import { fr } from '../../../i18n/fr';

// Admin reste FR-only -> on lit directement les strings depuis le dico FR
// sans passer par useLocale (qui suivrait la préférence UI globale).
export const FUN_FACTS = fr.funFacts;
export const TIER_TEXTS = fr.endGame.tiers;
export const ACHIEVEMENT_TEXTS = fr.achievements;
export const LEGAL_CONTENT = fr.legal;

export const PREVIEW_TOP_PLAYERS = [
  { name: 'Simi', score: 8, avatarId: 3 },
  { name: 'Léa', score: 6, avatarId: 9 },
  { name: 'Thomas', score: 5, avatarId: 16 },
];

export type ContentSection = 'tiers' | 'funfacts' | 'achievements' | 'avatars' | 'legal' | 'constants';

export const CONTENT_SECTIONS: { id: ContentSection; label: string; hint: string }[] = [
  { id: 'tiers', label: 'Paliers de score', hint: 'Le verdict affiché en fin de partie' },
  { id: 'funfacts', label: 'Le saviez-vous ?', hint: 'Les anecdotes affichées pendant les attentes' },
  { id: 'achievements', label: 'Succès', hint: 'Les badges que les joueurs débloquent' },
  { id: 'avatars', label: 'Avatars', hint: 'Les images au choix des joueurs' },
  { id: 'legal', label: 'Pages légales', hint: 'Mentions, confidentialité, contact' },
  { id: 'constants', label: 'Durées et limites', hint: 'Chronos des phases et limites des parties' },
];

export const PHASE_LABELS_FR: Record<string, string> = {
  QUESTION_SELECTION: 'Le pilier choisit la question',
  SUBSTITUTE_SELECTION: 'Le pilier choisit qui répond à sa place',
  ANSWERING: 'Les joueurs répondent',
  SUBSTITUTE_ANSWERING: 'Le joueur choisi écrit la réponse du pilier',
  GUESSING: 'Le pilier devine qui a écrit quoi',
};

export const LEGAL_LABELS_FR: Record<string, string> = {
  about: 'À propos',
  mentions: 'Mentions légales',
  privacy: 'Politique de confidentialité',
  contact: 'Nous contacter',
};
