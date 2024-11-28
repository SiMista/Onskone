import { Player } from '../models/Player';

export namespace PlayerManager {
    const players: Map<string, Player> = new Map();

    export const getPlayers = (): Player[] => {
        return Array.from(players.values());
    }

    export const getPlayer = (id: string): Player | undefined => {
        return players.get(id);
    }

    export const deletePlayer = (id: string): void => {
        players.delete(id);
    }

    export  const createPlayer = (name: string): Player => {
        const player = new Player(name);
        players.set(player.id, player);
        return player;
    }

    export const createHostPlayer = (name: string): Player => {
        const player = new Player(name, true); // isHost = true
        players.set(player.id, player);
        return player;
    }
}