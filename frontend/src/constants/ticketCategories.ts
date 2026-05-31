/**
 * Source unique des catégories de ticket (= "Signaler un problème").
 *
 * Les libellés/descriptions vivent dans le dictionnaire i18n
 * (t.ticketCategories[type]) ; ici on ne garde que les identifiants stables et
 * les métadonnées non textuelles (icône, glyphe admin).
 */

export type TicketType = 'question_report' | 'bug' | 'suggestion';

export interface TicketCategoryMeta {
  value: TicketType;
  /** Icône Iconify (utilisée dans le Report) */
  icon: string;
  /** Glyphe ASCII compact (utilisé par l'admin dans les chips/badges) */
  glyph: string;
}

export const TICKET_CATEGORIES: TicketCategoryMeta[] = [
  {
    value: 'question_report',
    icon: 'fluent-emoji-flat:warning',
    glyph: '?',
  },
  {
    value: 'bug',
    icon: 'fluent-emoji-flat:bug',
    glyph: '✖',
  },
  {
    value: 'suggestion',
    icon: 'fluent-emoji-flat:light-bulb',
    glyph: '✦',
  },
];

/** Lookup O(1) par value */
export const TICKET_CATEGORY_BY_VALUE: Record<TicketType, TicketCategoryMeta> =
  TICKET_CATEGORIES.reduce((acc, c) => {
    acc[c.value] = c;
    return acc;
  }, {} as Record<TicketType, TicketCategoryMeta>);
