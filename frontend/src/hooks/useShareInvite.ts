import { useCallback, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import type { Dictionary } from '../i18n/dictionary';
import { useToast } from '../components/Toast';
import { buildInviteUrl } from '../constants/game';

interface UseShareInviteResult {
  /** Partage natif/OS (cascade Capacitor → Web Share → copie message+lien). */
  shareNative: () => Promise<void>;
  /** Copie uniquement l'URL d'invitation (/join/<code>). */
  copyLink: () => void;
  /** Copie uniquement le code du salon. */
  copyCode: () => void;
  /** Lien à afficher quand toutes les méthodes de copie automatique ont échoué (sinon null). */
  fallbackLink: string | null;
  /** Réinitialise `fallbackLink` (fermeture de la modale de repli). */
  clearFallbackLink: () => void;
}

/**
 * Partage du lien d'invitation à un lobby. Expose trois actions granulaires
 * (partage OS, copie du lien, copie du code) alimentant la bottom sheet de
 * partage.
 *
 * `shareNative` applique trois niveaux de repli :
 *  1. App native (Capacitor) : plugin Share = intent de partage Android/iOS,
 *     fiable hors secure context (marche même en live-reload http) ;
 *  2. Web/PWA : Web Share API (mobile + Chrome/Edge desktop), exige HTTPS ;
 *  3. copie presse-papier (Clipboard API → `execCommand` → modale `fallbackLink`).
 */
export function useShareInvite(
  lobbyCode: string | undefined,
  t: Dictionary,
): UseShareInviteResult {
  const showToast = useToast();
  const [fallbackLink, setFallbackLink] = useState<string | null>(null);

  // Fallback pour copier sans l'API Clipboard (HTTP non-localhost).
  const fallbackCopy = useCallback((text: string, onSuccess: () => void) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      onSuccess();
    } catch (err) {
      console.error('Fallback copy failed:', err);
      setFallbackLink(text);
    }
    document.body.removeChild(textarea);
  }, []);

  const copyToClipboard = useCallback((text: string, onSuccess: () => void) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text)
        .then(onSuccess)
        .catch(() => fallbackCopy(text, onSuccess));
    } else {
      fallbackCopy(text, onSuccess);
    }
  }, [fallbackCopy]);

  const copyLink = useCallback(() => {
    const link = buildInviteUrl(lobbyCode!);
    copyToClipboard(link, () => showToast(t.lobby.toasts.linkCopied, 'success'));
  }, [lobbyCode, copyToClipboard, showToast, t]);

  const copyCode = useCallback(() => {
    copyToClipboard(lobbyCode!, () => showToast(t.lobby.toasts.codeCopied, 'success'));
  }, [lobbyCode, copyToClipboard, showToast, t]);

  const shareNative = useCallback(async () => {
    const link = buildInviteUrl(lobbyCode!);
    const message = t.lobby.shareInvite.message;
    // Le partage natif/Web Share a échoué ou n'existe pas : on n'essaie PAS de
    // copier en douce (toast "lien copié" trompeur), on invite explicitement à
    // utiliser le bouton "Copier le lien".
    const warnUnavailable = () => showToast(t.lobby.toasts.shareUnavailable, 'warning');

    // 1. App native (Capacitor) : plugin Share = intent de partage Android/iOS fiable,
    // indépendant du secure context (marche même en live-reload http).
    if (Capacitor.isNativePlatform()) {
      try {
        await Share.share({ title: t.lobby.shareInvite.title, text: message, url: link });
      } catch (err) {
        // Annulation utilisateur -> ne rien faire ; vraie indispo -> avertir
        if (!/cancel/i.test((err as Error)?.message ?? '')) warnUnavailable();
      }
      return;
    }

    // 2. Web/PWA : Web Share API (mobile + Chrome/Edge desktop), exige un secure context (HTTPS)
    if (navigator.share) {
      try {
        await navigator.share({ title: t.lobby.shareInvite.title, text: message, url: link });
      } catch (err) {
        // L'utilisateur a fermé/annulé la feuille -> ne rien faire ; sinon avertir
        if ((err as Error)?.name !== 'AbortError') warnUnavailable();
      }
      return;
    }

    // 3. Pas de Web Share API (desktop sans support) -> on invite à copier le lien
    warnUnavailable();
  }, [lobbyCode, showToast, t]);

  const clearFallbackLink = useCallback(() => setFallbackLink(null), []);

  return { shareNative, copyLink, copyCode, fallbackLink, clearFallbackLink };
}
