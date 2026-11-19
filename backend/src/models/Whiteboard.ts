import { WHITEBOARD, whiteboardStrokeId, type WhiteboardStroke } from '@onskone/shared';

interface StoredStroke extends WhiteboardStroke {
    ownerId: string;
}

/**
 * Valide un paquet de points reçu d'un client : tableau à plat [x0, y0, …] d'entiers
 * 0..RESOLUTION, 1 à MAX_POINTS_PER_CHUNK points. Tout ou rien (un client normal
 * n'envoie jamais rien d'autre) : null au moindre écart.
 */
export function sanitizeWhiteboardPoints(raw: unknown): number[] | null {
    if (!Array.isArray(raw)) return null;
    if (raw.length < 2 || raw.length % 2 !== 0 || raw.length > WHITEBOARD.MAX_POINTS_PER_CHUNK * 2) return null;
    for (const v of raw) {
        if (!Number.isInteger(v) || v < 0 || v > WHITEBOARD.RESOLUTION) return null;
    }
    return raw as number[];
}

/**
 * Tableau blanc d'une manche (cf. shared/src/whiteboard.ts). Garde les traits dans
 * l'ordre de création et compte les points pour tenir les limites : par trait, par
 * joueur et pour tout le tableau (un joueur ne peut pas monopoliser l'encre des autres,
 * et un salon ne peut pas faire gonfler la mémoire du serveur). Annuler un trait rend
 * son encre.
 */
export class Whiteboard {
    // Ordre d'insertion d'une Map = ordre de création : retirer un trait reste en O(1)
    // même avec des dizaines de milliers de traits (pas de limite en nombre de traits).
    private readonly byId = new Map<string, StoredStroke>();
    private readonly pointsByOwner = new Map<string, number>();
    private totalPoints = 0;

    /**
     * Ajoute des points au trait `localId` du joueur (créé s'il est nouveau), tronqués
     * à l'encre qui reste. Renvoie le trait avec les SEULS points acceptés (à diffuser),
     * ou null si rien n'a été ajouté.
     */
    draw(ownerId: string, color: number, localId: string, points: number[]): WhiteboardStroke | null {
        const id = whiteboardStrokeId(color, localId);
        let stroke = this.byId.get(id);
        // Même id, autre auteur (couleurs épuisées, cf. Game.getWhiteboardColor) : refusé.
        if (stroke && stroke.ownerId !== ownerId) return null;

        const strokeCount = stroke ? stroke.points.length / 2 : 0;
        const ownerCount = this.pointsByOwner.get(ownerId) ?? 0;
        const room = Math.min(
            WHITEBOARD.MAX_POINTS_PER_STROKE - strokeCount,
            WHITEBOARD.MAX_POINTS_PER_PLAYER - ownerCount,
            WHITEBOARD.MAX_POINTS_TOTAL - this.totalPoints,
        );
        const accepted = Math.min(points.length / 2, Math.max(0, room));
        if (accepted <= 0) return null;
        const added = points.slice(0, accepted * 2);

        if (!stroke) {
            stroke = { id, color, points: [], ownerId };
            this.byId.set(id, stroke);
        }
        stroke.points.push(...added);
        this.pointsByOwner.set(ownerId, ownerCount + accepted);
        this.totalPoints += accepted;
        return { id, color, points: added };
    }

    /** Retire un trait du joueur. Renvoie son id, ou null (inconnu ou pas à lui). */
    undo(ownerId: string, color: number, localId: string): string | null {
        const id = whiteboardStrokeId(color, localId);
        const stroke = this.byId.get(id);
        if (!stroke || stroke.ownerId !== ownerId) return null;
        const count = stroke.points.length / 2;
        this.byId.delete(id);
        this.pointsByOwner.set(ownerId, (this.pointsByOwner.get(ownerId) ?? 0) - count);
        this.totalPoints -= count;
        return id;
    }

    /** Tous les traits, dans l'ordre de création (vue publique : sans l'auteur). */
    snapshot(): WhiteboardStroke[] {
        return Array.from(this.byId.values(), ({ id, color, points }) => ({ id, color, points: [...points] }));
    }

    /** Vide le tableau (libère la mémoire quand la manche quitte QUESTION_SELECTION). */
    clear(): void {
        this.byId.clear();
        this.pointsByOwner.clear();
        this.totalPoints = 0;
    }

    get pointCount(): number {
        return this.totalPoints;
    }
}
