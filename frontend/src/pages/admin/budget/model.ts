// Budget d'Onskoné : frais fixes (tarifs publics des fournisseurs) et calculs de rentabilité
// du premium. Tout est pur ici (testé dans model.test.ts) ; l'écran est dans Budget.tsx.

export type CostPeriod = 'year' | 'once';

export interface CostLine {
  id: string;
  label: string;
  detail: string;
  /** Montant TTC en euros. */
  amount: number;
  period: CostPeriod;
  icon: string;
}

/** Frais de fonctionnement. Pour changer un tarif, c'est ici. */
export const COSTS: CostLine[] = [
  { id: 'apple', label: 'Compte Apple', detail: 'Développeur, pour publier sur l\'App Store', amount: 99, period: 'year', icon: 'mdi:apple' },
  { id: 'server', label: 'Serveur', detail: 'Héberge le jeu et les parties', amount: 70, period: 'year', icon: 'mdi:server-outline' },
  { id: 'domain', label: 'Nom de domaine', detail: 'L\'adresse du site', amount: 9, period: 'year', icon: 'mdi:web' },
  { id: 'google', label: 'Compte Google Play', detail: 'Développeur, pour publier sur le Play Store', amount: 25, period: 'once', icon: 'mdi:google-play' },
];

/** TVA française, comprise dans le prix affiché par les stores. */
export const VAT_RATE = 0.2;
/**
 * Commission des stores : 15 % sous 1 M$ de chiffre d'affaires par an (automatique chez
 * Google, programme « Small Business » à demander chez Apple, sinon 30 %).
 */
export const STORE_FEE = 0.15;
/** Prix du premium par défaut dans la simulation (le vrai prix est fixé dans les stores). */
export const DEFAULT_PRICE = 3.99;

export const yearlyCost = (costs: CostLine[] = COSTS): number =>
  costs.filter((c) => c.period === 'year').reduce((sum, c) => sum + c.amount, 0);

export const oneTimeCost = (costs: CostLine[] = COSTS): number =>
  costs.filter((c) => c.period === 'once').reduce((sum, c) => sum + c.amount, 0);

/** Ce qui reste pour une vente au prix `price` (TTC) : hors TVA, moins la commission du store. */
export const netPerSale = (price: number): number =>
  Math.max(0, price) / (1 + VAT_RATE) * (1 - STORE_FEE);

/** Où part une vente au prix `price` (TTC) : TVA, commission du store, et ce qui reste. */
export const saleBreakdown = (price: number): { vat: number; fee: number; net: number } => {
  const p = Math.max(0, price);
  const excl = p / (1 + VAT_RATE);
  return { vat: p - excl, fee: excl * STORE_FEE, net: excl * (1 - STORE_FEE) };
};

/** Prix comparés dans « Et si je change le prix ? » (et proposés en raccourci). */
export const PRICE_PRESETS = [2.99, 3.99, 4.99, 5.99, 6.99];

/** Ventes pour couvrir `amount` euros, arrondi au-dessus. null si une vente ne rapporte rien. */
export const salesToCover = (amount: number, price: number): number | null => {
  const net = netPerSale(price);
  return net > 0 ? Math.ceil(amount / net - 1e-9) : null;
};

/**
 * Coûts payés depuis le lancement après `month` mois : le paiement unique, plus chaque
 * année entamée (les abonnements se paient en début d'année).
 */
export const cumulativeCost = (month: number, costs: CostLine[] = COSTS): number =>
  oneTimeCost(costs) + yearlyCost(costs) * (Math.floor(month / 12) + 1);

export const cumulativeRevenue = (month: number, salesPerMonth: number, price: number): number =>
  month * salesPerMonth * netPerSale(price);

/** Au-delà, on considère que ça n'arrivera pas (50 ans). */
const MAX_MONTHS = 600;

/**
 * Mois à partir duquel les revenus couvrent les coûts pour de bon (sans repasser dessous au
 * renouvellement suivant). null si le rythme de ventes ne couvre pas les frais annuels.
 */
export const breakEvenMonth = (salesPerMonth: number, price: number, costs: CostLine[] = COSTS): number | null => {
  const yearlyRevenue = 12 * salesPerMonth * netPerSale(price);
  if (yearlyRevenue <= yearlyCost(costs) + 0.005) return null;
  // Au-delà de ce rythme, le retard (au moment où l'abonnement retombe) ne fait que
  // diminuer : le dernier mois en retard fixe le point de bascule.
  let lastBehind = -1;
  for (let m = 0; m <= MAX_MONTHS; m++) {
    // Au centime près : sinon un arrondi flottant laisse « en retard » d'un millionième.
    if (cumulativeRevenue(m, salesPerMonth, price) < cumulativeCost(m, costs) - 0.005) lastBehind = m;
  }
  return lastBehind + 1 >= MAX_MONTHS ? null : lastBehind + 1;
};

/**
 * Ventes par mois pour que l'année paie ses frais annuels, NON arrondi (5,3 et pas 6 :
 * « 63 par an, soit 6 par mois » sonnait faux, 6 × 12 = 72).
 */
export const salesPerMonthNeeded = (price: number, costs: CostLine[] = COSTS): number | null => {
  const net = netPerSale(price);
  return net > 0 ? yearlyCost(costs) / 12 / net : null;
};

const RATE = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
/** « 5,3 », « 6 » : un rythme de ventes, au dixième. */
export const formatRate = (n: number): string => RATE.format(n);

const EUR_ROUND = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const EUR_CENTS = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Euros : sans centimes si le montant est rond, sinon au centime. */
export const formatEuros = (n: number): string =>
  (Math.abs(n - Math.round(n)) < 0.005 ? EUR_ROUND : EUR_CENTS).format(n);

/** « 3 mois », « 1 an », « 2 ans et 4 mois ». */
export const formatMonths = (m: number): string => {
  const years = Math.floor(m / 12);
  const months = m % 12;
  const y = years > 0 ? `${years} an${years > 1 ? 's' : ''}` : '';
  const mo = months > 0 ? `${months} mois` : '';
  return [y, mo].filter(Boolean).join(' et ') || '0 mois';
};
