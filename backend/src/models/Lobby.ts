import { ILobby, GAME_CONSTANTS, SelectedDecks, GameMode, GameSpeed, Locale, DEFAULT_LOCALE, resolveSeatOrder } from '@onskone/shared';
import { IGame } from '../types/IGame';
import type { ServerPlayer } from '../types/ServerPlayer.js';
import { registerSocket, unregisterSocket } from '../managers/socketLobbyIndex.js';

/** Place d'un joueur parti : ses voisins et son rang, pour la lui rendre s'il revient. */
interface DepartedSeat {
    prevId?: string;
    nextId?: string;
    index: number;
}

// Plafond de places mémorisées par salon (les plus anciennes sont oubliées).
const MAX_DEPARTED_SEATS = GAME_CONSTANTS.MAX_PLAYERS * 2;

export class Lobby implements ILobby {
    code: string;
    // Vue serveur : socketId + reconnectToken garantis présents (cf. ServerPlayer).
    // Assignable au contrat public ILobby.players (IPlayer[]) car ServerPlayer ⊇ IPlayer.
    players: ServerPlayer[];
    game: IGame | null;
    lastActivity: Date;
    selectedDecks: SelectedDecks;
    gameMode: GameMode;
    guessMyAnswerMode: boolean;
    gameSpeed: GameSpeed;
    excludedLeaderIds: string[];
    // Places autour de la table (ids, sens du jeu) : ordre du reveal uniquement
    // (à partir de la gauche du pilier) ; les piliers sont tirés au hasard.
    seatOrder: string[];
    // Écran « Préparer la partie » ouvert par l'hôte : toute la table le suit. Le
    // salon reste en attente (on peut encore le rejoindre) jusqu'au lancement.
    preparing: boolean;
    locale: Locale;
    // Places des joueurs partis, par nom en minuscules (pas par id : un revenant
    // après la période de grâce rejoint avec un nouvel id). Serveur uniquement.
    private departedSeats: Map<string, DepartedSeat> = new Map();

    constructor(lobbyCode: string, locale: Locale = DEFAULT_LOCALE) {
        this.code = lobbyCode;
        this.players = [];
        this.game = null;
        this.lastActivity = new Date();
        this.locale = locale;
        // Aucun thème coché à la création : l'hôte choisit les siens (startGame refuse une sélection vide).
        this.selectedDecks = {};
        this.gameMode = 'local';
        this.guessMyAnswerMode = false;
        this.gameSpeed = GAME_CONSTANTS.GAME_SPEED_DEFAULT;
        this.excludedLeaderIds = [];
        this.seatOrder = [];
        this.preparing = false;
    }

    /** Les joueurs dans l'ordre des places : c'est l'ordre diffusé aux clients. */
    getSeatedPlayers(): ServerPlayer[] {
        const byId = new Map(this.players.map(p => [p.id, p]));
        return resolveSeatOrder(this.seatOrder, this.players.map(p => p.id)).map(id => byId.get(id)!);
    }

    /**
     * Places choisies par l'hôte : n'importe quel ordre des joueurs présents (ids
     * inconnus et doublons ignorés, joueurs oubliés remis en fin, cf.
     * resolveSeatOrder). false si la liste est mal formée : pas un tableau de
     * textes, ou plus longue qu'un salon plein.
     */
    setSeatOrder(raw: unknown): boolean {
        if (!Array.isArray(raw) || raw.length > GAME_CONSTANTS.MAX_PLAYERS) return false;
        if (!raw.every((id): id is string => typeof id === 'string')) return false;
        this.seatOrder = resolveSeatOrder(raw, this.players.map(p => p.id));
        return true;
    }

    updateActivity(): void {
        this.lastActivity = new Date();
    }

    addPlayer(player: ServerPlayer): void {
        if (this.players.length >= GAME_CONSTANTS.MAX_PLAYERS) {
            throw new Error(`Le salon est plein (maximum ${GAME_CONSTANTS.MAX_PLAYERS} joueurs)`);
        }
        this.players.push(player);
        // Chokepoint unique d'entrée d'un joueur : maintient l'index socketId -> lobby
        // et lui donne une place à table.
        registerSocket(player.socketId, this.code);
        this.seatPlayer(player);
        // Plafond de manches par défaut : à partir du 9e joueur, l'arrivant n'est pas
        // pilier (l'hôte peut le re-cocher). Les piliers déjà choisis ne bougent pas.
        const leaders = this.players.filter(p => p.id !== player.id && !this.excludedLeaderIds.includes(p.id)).length;
        if (leaders >= GAME_CONSTANTS.DEFAULT_MAX_ROUNDS) {
            this.excludedLeaderIds = [...this.excludedLeaderIds, player.id];
        }
    }

    /**
     * Donne une place à un arrivant : la dernière, ou, s'il revient, la sienne
     * (après son ancien voisin de gauche, sinon avant celui de droite, sinon à son
     * ancien rang). Les autres gardent leur ordre.
     */
    private seatPlayer(player: ServerPlayer): void {
        const key = player.name.toLowerCase();
        const departed = this.departedSeats.get(key);
        this.departedSeats.delete(key);

        const seats = this.seatOrder.filter(id => id !== player.id);
        let at = seats.length;
        if (departed) {
            const prev = departed.prevId ? seats.indexOf(departed.prevId) : -1;
            const next = departed.nextId ? seats.indexOf(departed.nextId) : -1;
            if (prev >= 0) at = prev + 1;
            else if (next >= 0) at = next;
            else at = Math.min(departed.index, seats.length);
        }
        seats.splice(at, 0, player.id);
        this.seatOrder = seats;
    }

    /** Libère la place d'un partant (les autres se resserrent sans changer d'ordre) en la mémorisant. */
    private unseatPlayer(player: ServerPlayer): void {
        const at = this.seatOrder.indexOf(player.id);
        if (at < 0) return;
        const key = player.name.toLowerCase();
        // delete + set : la place la plus récente passe en fin de Map (oubliée en dernier).
        this.departedSeats.delete(key);
        this.departedSeats.set(key, {
            prevId: this.seatOrder[at - 1],
            nextId: this.seatOrder[at + 1],
            index: at,
        });
        if (this.departedSeats.size > MAX_DEPARTED_SEATS) {
            const oldest = this.departedSeats.keys().next().value;
            if (oldest !== undefined) this.departedSeats.delete(oldest);
        }
        this.seatOrder = this.seatOrder.filter(id => id !== player.id);
    }

    setHost(player: ServerPlayer): void {
        this.players.forEach(p => {
            // Comparer par id, pas par nom (deux joueurs peuvent théoriquement avoir le même nom)
            p.isHost = p.id === player.id;
        });
    }

    removePlayer(player: ServerPlayer): void {
        this.players = this.players.filter(p => p.id !== player.id);
        // Chokepoint unique de sortie d'un joueur : purge son entrée d'index et son
        // éventuelle exclusion du rôle de pilier (un id parti ne doit pas traîner),
        // et libère sa place à table en la gardant pour son retour.
        unregisterSocket(player.socketId);
        this.excludedLeaderIds = this.excludedLeaderIds.filter(id => id !== player.id);
        this.unseatPlayer(player);
    }

    getPlayer(playerId: string): ServerPlayer | undefined {
        return this.players.find(p => p.id === playerId);
    }

    /** L'hôte courant du lobby (le joueur marqué isHost), ou undefined s'il n'y en a pas. */
    getHost(): ServerPlayer | undefined {
        return this.players.find(p => p.isHost);
    }

    /**
     * Statut premium de l'host (serveur-only, non diffusé dans ILobby). Autorise la
     * sélection des thèmes premium pour toute la table (gating "l'host débloque pour
     * tous"). DÉRIVÉ de l'host courant, jamais mémorisé : son `isPremium` est relu au
     * handshake à chaque (re)connexion, donc un achat en plein salon (le front
     * reconnecte la socket) débloque aussitôt, et un transfert d'host suit le nouveau.
     * Avant, un booléen figé au createLobby recochait l'achat en « non premium ».
     */
    get hostIsPremium(): boolean {
        return !!this.getHost()?.isPremium;
    }
}