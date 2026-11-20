import { describe, it, expect } from 'vitest';
import {
  COSTS, breakEvenMonth, calendarMonth, cumulativeCost, formatMonthShort, formatMonthYear, cumulativeRevenue, formatEuros, formatMonths,
  formatRate, netPerSale, oneTimeCost, saleBreakdown, salesPerMonthNeeded, salesToCover, yearlyCost, type CostLine,
} from './model';

describe('budget : frais fixes', () => {
  it('sépare les abonnements annuels du paiement unique', () => {
    expect(yearlyCost()).toBe(99 + 70 + 9);
    expect(oneTimeCost()).toBe(25);
    expect(COSTS.every((c) => c.amount > 0)).toBe(true);
  });

  it("chaque année entamée se paie d'avance, le paiement unique une seule fois", () => {
    expect(cumulativeCost(0)).toBe(25 + 178);
    expect(cumulativeCost(11)).toBe(25 + 178);
    expect(cumulativeCost(12)).toBe(25 + 2 * 178);
    expect(cumulativeCost(36)).toBe(25 + 4 * 178);
  });
});

describe('budget : ce que rapporte une vente', () => {
  it('retire la TVA puis la commission du store', () => {
    expect(netPerSale(3.99)).toBeCloseTo(3.99 / 1.2 * 0.85, 10);
    expect(netPerSale(0)).toBe(0);
    expect(netPerSale(-2)).toBe(0);
  });

  it('une vente = TVA + store + ce qui reste, au centime près', () => {
    const { vat, fee, net } = saleBreakdown(3.99);
    expect(vat + fee + net).toBeCloseTo(3.99, 10);
    expect(vat).toBeCloseTo(3.99 - 3.99 / 1.2, 10);
    expect(fee).toBeCloseTo(3.99 / 1.2 * 0.15, 10);
    expect(net).toBeCloseTo(netPerSale(3.99), 10);
  });

  it('arrondit les ventes nécessaires au-dessus, et rien ne couvre quoi que ce soit à 0 €', () => {
    const net = netPerSale(3.99);
    expect(salesToCover(net * 10, 3.99)).toBe(10);
    expect(salesToCover(net * 10 + 0.01, 3.99)).toBe(11);
    expect(salesToCover(100, 0)).toBeNull();
    expect(salesPerMonthNeeded(0)).toBeNull();
  });
});

describe('budget : point de rentabilité', () => {
  const simple: CostLine[] = [
    { id: 'a', label: 'A', detail: '', amount: 120, period: 'year', icon: '' },
  ];
  // Prix qui rapporte pile 10 € net par vente.
  const price = 10 / 0.85 * 1.2;

  it("jamais si l'année ne paie pas ses frais annuels", () => {
    expect(breakEvenMonth(1, price, simple)).toBeNull(); // 120 €/an : pile les frais, pas mieux
    expect(breakEvenMonth(0, price, simple)).toBeNull();
  });

  it('ne compte pas une avance que le renouvellement suivant efface', () => {
    // 2 ventes/mois = 20 €/mois : 1re année (120 €) payée au mois 6, et ça tient ensuite
    // (240 € au mois 12 pour 240 € de frais, 480 € au mois 24 pour 360 €).
    expect(breakEvenMonth(2, price, simple)).toBe(6);
    // 1,5 vente/mois = 15 €/mois : 120 € au mois 8, mais la 2e année tombe au mois 12
    // (180 € pour 240 €) ; rattrapé au mois 16 (240 €), et ça tient ensuite.
    expect(breakEvenMonth(1.5, price, simple)).toBe(16);
    expect(cumulativeRevenue(12, 1.5, price)).toBeLessThan(cumulativeCost(12, simple));
    expect(cumulativeRevenue(16, 1.5, price)).toBeCloseTo(cumulativeCost(16, simple), 6);
  });

  it("le rythme nécessaire, non arrondi, paie pile une année (cohérent avec les ventes par an)", () => {
    const n = salesPerMonthNeeded(3.99)!;
    expect(n * 12 * netPerSale(3.99)).toBeCloseTo(yearlyCost(), 6);
    expect(Math.ceil(n * 12 - 1e-9)).toBe(salesToCover(yearlyCost(), 3.99));
    expect(formatRate(n)).toBe('5,2');
  });
});

describe('budget : affichage', () => {
  it('euros ronds sans centimes, sinon au centime', () => {
    expect(formatEuros(178).replace(/\s/g, ' ')).toBe('178 €');
    expect(formatEuros(2.8262).replace(/\s/g, ' ')).toBe('2,83 €');
  });

  it('durées lisibles', () => {
    expect(formatMonths(0)).toBe('0 mois');
    expect(formatMonths(5)).toBe('5 mois');
    expect(formatMonths(12)).toBe('1 an');
    expect(formatMonths(28)).toBe('2 ans et 4 mois');
  });
});

describe('budget : vraies dates', () => {
  const launch = { year: 2026, month: 5 };
  it('compte les mois depuis le lancement, en changeant d\'année au bon moment', () => {
    expect(calendarMonth(0, launch)).toEqual({ year: 2026, month: 5 });
    expect(calendarMonth(6, launch)).toEqual({ year: 2026, month: 11 });
    expect(calendarMonth(7, launch)).toEqual({ year: 2027, month: 0 });
    expect(calendarMonth(36, launch)).toEqual({ year: 2029, month: 5 });
  });

  it('écrit le mois en français', () => {
    expect(formatMonthYear(0, launch)).toBe('juin 2026');
    expect(formatMonthYear(11, launch)).toBe('mai 2027');
    expect(formatMonthShort(3, launch)).toBe('sept.');
  });
});
