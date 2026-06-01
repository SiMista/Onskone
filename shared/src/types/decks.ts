/**
 * Métadonnées d'un thème (résolues dans la langue du lobby) - envoyées au
 * front pour afficher la sélection des thèmes (modal de paramétrage).
 *
 * Le `code` est un identifiant stable indépendant de la langue (ex. `DAILY`,
 * `HOBBIES`) - c'est lui qu'on stocke dans `SelectedDecks` pour que la
 * sélection survive à un switch de langue.
 *
 * Source de vérité : `backend/src/data/themes.json`.
 */
export interface ThemeInfo {
  code: string;
  name: string;
  description: string;
  emoji: string;
  /** Contenu réservé aux adultes - désactivé par défaut, requiert confirmation à l'activation. */
  mature?: boolean;
}

/**
 * Catalogue compact des thèmes disponibles : { catégorie: [code...] }
 * Utilisé pour la validation des sélections côté serveur et l'itération
 * légère côté client (les détails d'affichage viennent de `DecksCatalogWithMeta`).
 */
export type DecksCatalog = Record<string, string[]>;

/**
 * Catalogue enrichi (envoyé au front) : { catégorie: [ThemeInfo...] }
 * Les libellés et descriptions sont déjà résolus dans la langue du lobby.
 */
export type DecksCatalogWithMeta = Record<string, ThemeInfo[]>;

/**
 * Sélection actuelle dans le lobby : { catégorie: [codes stables...] }
 * Indépendante de la langue. Une catégorie absente ou avec un tableau vide
 * signifie qu'aucun thème de cette catégorie n'est sélectionné.
 */
export type SelectedDecks = Record<string, string[]>;
