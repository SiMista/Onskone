import { useCallback, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import type { Dictionary } from '../i18n/dictionary';
import { useToast } from '../components/Toast';

interface UseShareInviteResult {
  /** Déclenche le partage de l'invitation (cascade native → Web Share → copie). */
  shareInvite: () => Promise<void>;
  /** Lien à afficher quand toutes les méthodes de copie automatique ont échoué (sinon null). */
  fallbackLink: string | null;
  /** Réinitialise `fallbackLink` (fermeture de la modale de repli). */
  clearFallbackLink: () => void;
}

/**
 * Partage du lien d'invitation à un lobby, avec trois niveaux de repli :
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

  const shareInvite = useCallback(async () => {
    const link = `${window.location.origin}/?lobbyCode=${lobbyCode!}`;
    const message = t.lobby.shareInvite.message;
    // Texte copié dans le presse-papier : message + lien (l'API share gère le lien à part)
    const copyText = `${message} ${link}`;

    const showCopied = () => {
      showToast(t.lobby.toasts.linkCopied, 'success');
    };

    // Fallback pour copier sans l'API Clipboard (HTTP non-localhost)
    const fallbackCopy = (text: string) => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        showCopied();
      } catch (err) {
        console.error('Fallback copy failed:', err);
        setFallbackLink(text);
      }
      document.body.removeChild(textarea);
    };

    const copyToClipboard = (text: string) => {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text)
          .then(() => showCopied())
          .catch(() => fallbackCopy(text));
      } else {
        fallbackCopy(text);
      }
    };

    // 1. App native (Capacitor) : plugin Share = intent de partage Android/iOS fiable,
    // indépendant du secure context (marche même en live-reload http).
    if (Capacitor.isNativePlatform()) {
      try {
        await Share.share({ title: t.lobby.shareInvite.title, text: message, url: link });
      } catch {
        // Annulation ou indispo -> copie
        copyToClipboard(copyText);
      }
      return;
    }

    // 2. Web/PWA : Web Share API (mobile + Chrome/Edge desktop), exige un secure context (HTTPS)
    if (navigator.share) {
      try {
        await navigator.share({ title: t.lobby.shareInvite.title, text: message, url: link });
        return; // succès : la feuille native sert de feedback
      } catch (err) {
        // L'utilisateur a fermé/annulé la feuille -> ne rien faire
        if ((err as Error)?.name === 'AbortError') return;
        // Autre erreur (non supporté à l'exécution) -> on retombe sur la copie
      }
    }

    // 3. Fallback : copie du message + lien dans le presse-papier
    copyToClipboard(copyText);
  }, [lobbyCode, showToast, t]);

  const clearFallbackLink = useCallback(() => setFallbackLink(null), []);

  return { shareInvite, fallbackLink, clearFallbackLink };
}
