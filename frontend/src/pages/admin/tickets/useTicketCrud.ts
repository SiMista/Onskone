import { useCallback, useState } from 'react';
import { useToast } from '../../../components/Toast';
import { Ticket, TicketStatus, updateTicketStatus, deleteTicket } from '../../../utils/ticketsApi';

type PendingDelete =
  | { kind: 'single'; id: number }
  | { kind: 'bulk'; ids: number[] }
  | null;

interface UseTicketCrudArgs {
  /** Setter du store de tickets (mutations optimistes). */
  onChangeTickets: (next: Ticket[] | ((prev: Ticket[]) => Ticket[])) => void;
  /** Ids actuellement sélectionnés (pour les actions bulk). */
  selectedIds: number[];
  /** Vide la sélection après une action bulk réussie. */
  clearSelection: () => void;
  /** Retire les ids supprimés de la sélection (delete). */
  removeFromSelection: (ids: number[]) => void;
  /** Notifie le panel qu'un ticket supprimé était ouvert (pour fermer la modale). */
  onDeleted?: (ids: number[]) => void;
}

interface UseTicketCrud {
  /** Demande de suppression en attente (confirmation), ou null. */
  pendingDelete: PendingDelete;
  /** Annule la confirmation de suppression. */
  cancelDelete: () => void;
  /** Change le statut d'un ticket (optimiste). */
  changeStatus: (id: number, status: TicketStatus) => Promise<void>;
  /** Ouvre la confirmation de suppression d'un ticket. */
  requestDelete: (id: number) => void;
  /** Ouvre la confirmation de suppression des tickets sélectionnés. */
  requestBulkDelete: () => void;
  /** Exécute la suppression confirmée (single ou bulk). */
  confirmDelete: () => Promise<void>;
  /** Déplace les tickets sélectionnés vers un statut (optimiste). */
  bulkMove: (status: TicketStatus) => Promise<void>;
}

/**
 * Logique CRUD + bulk des tickets, factorisée hors du panel. Centralise les
 * appels API, les mutations optimistes et la machine de confirmation de
 * suppression (single/bulk), avec toasts d'erreur/succès.
 */
export const useTicketCrud = ({
  onChangeTickets,
  selectedIds,
  clearSelection,
  removeFromSelection,
  onDeleted,
}: UseTicketCrudArgs): UseTicketCrud => {
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const showToast = useToast();

  const changeStatus = useCallback(async (id: number, status: TicketStatus) => {
    try {
      await updateTicketStatus(id, status);
      onChangeTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    }
  }, [onChangeTickets, showToast]);

  const requestDelete = useCallback((id: number) => {
    setPendingDelete({ kind: 'single', id });
  }, []);

  const requestBulkDelete = useCallback(() => {
    if (!selectedIds.length) return;
    setPendingDelete({ kind: 'bulk', ids: [...selectedIds] });
  }, [selectedIds]);

  const cancelDelete = useCallback(() => setPendingDelete(null), []);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    const ids = pendingDelete.kind === 'single' ? [pendingDelete.id] : pendingDelete.ids;
    setPendingDelete(null);
    try {
      await Promise.all(ids.map((id) => deleteTicket(id)));
      onChangeTickets((prev) => prev.filter((t) => !ids.includes(t.id)));
      removeFromSelection(ids);
      onDeleted?.(ids);
      showToast(`${ids.length} ticket${ids.length > 1 ? 's' : ''} supprimé${ids.length > 1 ? 's' : ''}`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    }
  }, [pendingDelete, onChangeTickets, removeFromSelection, onDeleted, showToast]);

  const bulkMove = useCallback(async (status: TicketStatus) => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    try {
      await Promise.all(ids.map((id) => updateTicketStatus(id, status)));
      const idSet = new Set(ids);
      onChangeTickets((prev) => prev.map((t) => (idSet.has(t.id) ? { ...t, status } : t)));
      showToast(`${ids.length} ticket${ids.length > 1 ? 's' : ''} déplacé${ids.length > 1 ? 's' : ''}`, 'success');
      clearSelection();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    }
  }, [selectedIds, onChangeTickets, clearSelection, showToast]);

  return {
    pendingDelete,
    cancelDelete,
    changeStatus,
    requestDelete,
    requestBulkDelete,
    confirmDelete,
    bulkMove,
  };
};
