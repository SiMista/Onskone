/**
 * Catalogue des decks disponibles : { catégorie: [thèmes...] }
 * Construit côté serveur à partir de questions.json.
 */
export type DecksCatalog = Record<string, string[]>;

/**
 * Sélection actuelle dans le lobby : { catégorie: [thèmes sélectionnés...] }
 * Une catégorie absente ou avec un tableau vide signifie qu'aucun thème de
 * cette catégorie n'est sélectionné.
 */
export type SelectedDecks = Record<string, string[]>;
