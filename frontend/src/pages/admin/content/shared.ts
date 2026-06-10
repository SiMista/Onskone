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
  { id: 'tiers', label: 'Paliers de score', hint: 'verdict de fin de partie' },
  { id: 'funfacts', label: 'Saviez-vous', hint: 'faits insolites' },
  { id: 'achievements', label: 'Succès', hint: 'badges du joueur' },
  { id: 'avatars', label: 'Avatars', hint: 'galerie' },
  { id: 'legal', label: 'Légal', hint: 'pages publiques' },
  { id: 'constants', label: 'Réglages', hint: 'durées & limites' },
];

export const PHASE_LABELS_FR: Record<string, string> = {
  QUESTION_SELECTION: 'Sélection de la question',
  SUBSTITUTE_SELECTION: 'Sélection du devineur de pilier',
  ANSWERING: 'Réponse des joueurs',
  SUBSTITUTE_ANSWERING: 'Réponse du devineur de pilier',
  GUESSING: 'Devinette',
};

export const LEGAL_LABELS_FR: Record<string, string> = {
  about: 'À propos',
  mentions: 'Mentions légales',
  privacy: 'Politique de confidentialité',
  contact: 'Nous contacter',
};
