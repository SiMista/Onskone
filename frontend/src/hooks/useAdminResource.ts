import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../components/Toast';

interface UseAdminResourceOptions<T> {
  /** Fonction de fetch (async). Sa référence doit être stable (useCallback). */
  fetcher: () => Promise<T>;
  /** N'active le chargement/polling que lorsque le panel est visible. Défaut true. */
  active?: boolean;
  /**
   * Intervalle de rafraîchissement silencieux (ms). 0 / undefined = pas de
   * polling. Les refresh silencieux ne togglent pas `isLoading` ni les toasts.
   */
  refreshMs?: number;
  /**
   * Compteur externe : chaque incrément force un reload non-silencieux. Utile
   * pour le bouton "rafraîchir" global de l'admin. La valeur 0 est ignorée
   * (montage initial déjà couvert par l'effet principal).
   */
  refreshKey?: number;
  /** Message de toast par défaut si l'erreur n'a pas de `.message`. Défaut "Erreur". */
  errorMessage?: string;
}

interface UseAdminResource<T> {
  /** Données courantes (null tant que le premier fetch n'a pas abouti). */
  data: T | null;
  /** True pendant un chargement non-silencieux. */
  isLoading: boolean;
  /** Timestamp epoch (ms) du dernier fetch réussi, ou null. */
  lastFetch: number | null;
  /** Recharge manuellement. `silent` = sans spinner ni toast (pour le polling). */
  reload: (silent?: boolean) => Promise<void>;
  /** Setter exposé pour les mutations optimistes (ex: après un PATCH). */
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

/**
 * Pattern admin factorisé (Lobbies/Overview/Tickets…) : load + isLoading +
 * try/catch + toast d'erreur, avec polling silencieux optionnel et re-trigger
 * sur `refreshKey`.
 *
 * Le fetcher DOIT être stable (mémoïse-le avec useCallback côté appelant),
 * sinon le polling se réinitialiserait à chaque render.
 */
export function useAdminResource<T>({
  fetcher,
  active = true,
  refreshMs,
  refreshKey = 0,
  errorMessage = 'Erreur',
}: UseAdminResourceOptions<T>): UseAdminResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<number | null>(null);
  const showToast = useToast();

  const reload = useCallback(
    async (silent = false) => {
      if (!silent) setIsLoading(true);
      try {
        const result = await fetcher();
        setData(result);
        setLastFetch(Date.now());
      } catch (err) {
        if (!silent) showToast(err instanceof Error ? err.message : errorMessage, 'error');
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [fetcher, showToast, errorMessage],
  );

  // Chargement initial + polling silencieux tant que le panel est actif.
  useEffect(() => {
    if (!active) return;
    reload();
    if (!refreshMs) return;
    const id = setInterval(() => reload(true), refreshMs);
    return () => clearInterval(id);
  }, [active, refreshMs, reload]);

  // Re-trigger sur le compteur global de rafraîchissement (0 = ignoré).
  useEffect(() => {
    if (!active || refreshKey === 0) return;
    reload();
  }, [refreshKey, active, reload]);

  return { data, isLoading, lastFetch, reload, setData };
}
