/**
 * Anti-bruteforce du login admin. Ne compte que les ÉCHECS (un admin qui se connecte bien
 * ne s'use rien) et durcit à deux niveaux :
 *
 * - par IP : quelques essais libres, puis un verrou qui DOUBLE à chaque nouvel échec
 *   (1 min, 2, 4… jusqu'à 1 h). Un succès efface l'ardoise de l'IP.
 * - global : au-delà d'un plafond d'échecs sur l'heure, toutes IP confondues, le login est
 *   fermé jusqu'à ce que la fenêtre se vide (attaque distribuée sur des milliers d'IP, que
 *   le verrou par IP ne voit pas). Contrepartie assumée : pendant une telle attaque, l'admin
 *   aussi attend. Le jeu, lui, n'est jamais touché.
 *
 * Pur et à horloge injectable (testé dans tests/loginGuard.test.ts).
 */

export interface LoginGuardOptions {
  /** Échecs libres par IP avant le premier verrou. */
  freeFailures: number;
  /** Durée du premier verrou (ms), doublée à chaque échec suivant. */
  baseLockMs: number;
  /** Plafond du verrou par IP (ms). */
  maxLockMs: number;
  /** Sans échec pendant ce temps, l'IP repart de zéro (ms). */
  forgetAfterMs: number;
  /** Échecs toutes IP confondues avant fermeture globale… */
  globalMaxFailures: number;
  /** …sur cette fenêtre glissante (ms). */
  globalWindowMs: number;
  /** Plafond d'IP suivies (mémoire bornée face à une attaque distribuée). */
  maxTrackedIps?: number;
  now?: () => number;
}

interface IpState {
  failures: number;
  lockedUntil: number;
  lastFailure: number;
}

export type LoginCheck = { allowed: true } | { allowed: false; retryAfterMs: number; reason: 'ip' | 'global' };

export class LoginGuard {
  private readonly opts: Required<LoginGuardOptions>;
  private readonly ips = new Map<string, IpState>();
  /** Horodatages des échecs récents, toutes IP (triés, purgés au fil de l'eau). */
  private globalFailures: number[] = [];

  constructor(options: LoginGuardOptions) {
    this.opts = { maxTrackedIps: 10000, now: Date.now, ...options };
  }

  /** À appeler AVANT de vérifier le mot de passe : pendant un verrou, on ne le teste même pas. */
  check(ip: string): LoginCheck {
    const now = this.opts.now();
    this.pruneGlobal(now);
    if (this.globalFailures.length >= this.opts.globalMaxFailures) {
      const oldest = this.globalFailures[0];
      return { allowed: false, retryAfterMs: oldest + this.opts.globalWindowMs - now, reason: 'global' };
    }
    const state = this.ips.get(ip);
    if (state && state.lockedUntil > now) {
      return { allowed: false, retryAfterMs: state.lockedUntil - now, reason: 'ip' };
    }
    return { allowed: true };
  }

  /** Mauvais mot de passe : renvoie le nombre d'échecs de l'IP (pour les logs). */
  recordFailure(ip: string): number {
    const now = this.opts.now();
    this.globalFailures.push(now);
    let state = this.ips.get(ip);
    if (!state || now - state.lastFailure > this.opts.forgetAfterMs) {
      if (!state && this.ips.size >= this.opts.maxTrackedIps) this.evict(now);
      state = { failures: 0, lockedUntil: 0, lastFailure: now };
      this.ips.set(ip, state);
    }
    state.failures++;
    state.lastFailure = now;
    const over = state.failures - this.opts.freeFailures;
    if (over > 0) {
      // 2^(over-1) plafonné sans calculer d'énormes puissances.
      const lock = Math.min(this.opts.maxLockMs, this.opts.baseLockMs * 2 ** Math.min(over - 1, 30));
      state.lockedUntil = now + lock;
    }
    return state.failures;
  }

  /** Bon mot de passe : l'IP repart de zéro (le compteur global, lui, s'écoule seul). */
  recordSuccess(ip: string): void {
    this.ips.delete(ip);
  }

  private pruneGlobal(now: number): void {
    const cutoff = now - this.opts.globalWindowMs;
    let i = 0;
    while (i < this.globalFailures.length && this.globalFailures[i] <= cutoff) i++;
    if (i > 0) this.globalFailures = this.globalFailures.slice(i);
  }

  /** Fait de la place : d'abord les IP oubliables, sinon les plus anciennes (Map = ordre d'insertion). */
  private evict(now: number): void {
    for (const [ip, s] of this.ips) {
      if (s.lockedUntil <= now && now - s.lastFailure > this.opts.forgetAfterMs) this.ips.delete(ip);
    }
    if (this.ips.size < this.opts.maxTrackedIps) return;
    const excess = this.ips.size - this.opts.maxTrackedIps + 1;
    let n = 0;
    for (const ip of this.ips.keys()) {
      if (n++ >= excess) break;
      this.ips.delete(ip);
    }
  }
}
