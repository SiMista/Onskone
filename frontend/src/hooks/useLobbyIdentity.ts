import { useState } from 'react';
import type { useSearchParams } from 'react-router-dom';
import { studioStorage } from '../utils/studioStorage';
import { AVATARS } from '../constants/game';

type SearchParams = ReturnType<typeof useSearchParams>[0];

/**
 * Dérive l'identité du joueur (nom + avatar) pour un lobby donné.
 *
 * Ordre de résolution (figé au montage, d'où le `useState` lazy) :
 *  1. paramètre d'URL (`playerName` / `avatarId`) — utilisé par le Studio,
 *     persisté dans le storage namespacé par slot ;
 *  2. valeur précédemment sauvegardée dans `studioStorage` pour ce lobby ;
 *  3. valeur aléatoire de repli (nouveau joueur).
 *
 * Toujours passer par `studioStorage` (jamais `localStorage` direct) pour ne
 * pas faire fuiter l'état entre les iframes du Studio.
 */
export function useLobbyIdentity(
  lobbyCode: string | undefined,
  searchParams: SearchParams,
): { playerName: string; avatarId: number } {
  const [playerName] = useState<string>(() => {
    const urlPlayerName = searchParams.get('playerName');
    if (urlPlayerName) {
      studioStorage.setItem(`playerName_${lobbyCode}`, urlPlayerName);
      return urlPlayerName;
    }
    const savedPlayerName = studioStorage.getItem(`playerName_${lobbyCode}`);
    if (savedPlayerName) {
      return savedPlayerName;
    }
    const randomName = `Joueur${Math.floor(Math.random() * 1000)}`;
    studioStorage.setItem(`playerName_${lobbyCode}`, randomName);
    return randomName;
  });

  const [avatarId] = useState<number>(() => {
    const urlAvatarId = searchParams.get('avatarId');
    if (urlAvatarId !== null) {
      const id = parseInt(urlAvatarId, 10);
      if (!isNaN(id)) {
        studioStorage.setItem(`avatarId_${lobbyCode}`, String(id));
        return id;
      }
    }
    const savedAvatarId = studioStorage.getItem(`avatarId_${lobbyCode}`);
    if (savedAvatarId !== null) {
      const id = parseInt(savedAvatarId, 10);
      if (!isNaN(id)) return id;
    }
    return Math.floor(Math.random() * AVATARS.length);
  });

  return { playerName, avatarId };
}
