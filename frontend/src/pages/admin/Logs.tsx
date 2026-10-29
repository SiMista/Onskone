import { useCallback, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { useToast } from '../../components/Toast';
import { useAdminResource } from '../../hooks';
import { ClientLog, clearClientLogs, fetchClientLogs } from '../../utils/adminDataApi';
import { ConfirmDialog } from './ConfirmDialog';
import { BADGE, BADGE_TONES, EmptyState, LoadingState, PANEL, SearchField, Segmented, badge, btn, Strip } from './ui';

const LOGS_REFRESH_MS = 10000;

const PLATFORM_META: Record<string, { label: string; chip: string }> = {
  ios: { label: 'iOS', chip: BADGE_TONES.sky },
  android: { label: 'Android', chip: BADGE_TONES.emerald },
  web: { label: 'Web', chip: BADGE_TONES.neutral },
};

const LEVEL_META: Record<ClientLog['level'], { label: string; icon: string; dot: string; text: string }> = {
  error: { label: 'Erreur', icon: 'mdi:alert-circle-outline', dot: 'bg-rose-400', text: 'text-rose-200' },
  warn: { label: 'Alerte', icon: 'mdi:alert-outline', dot: 'bg-amber-400', text: 'text-amber-200' },
  info: { label: 'Info', icon: 'mdi:information-outline', dot: 'bg-white/40', text: 'text-white/70' },
};

const formatDate = (ms: number): string =>
  new Date(ms).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

/** Contexte JSON joliment indenté ; brut si ce n'est pas du JSON valide. */
const prettyContext = (context: string | null): string | null => {
  if (!context) return null;
  try { return JSON.stringify(JSON.parse(context), null, 2); } catch { return context; }
};

const LogRow = ({ log }: { log: ClientLog }) => {
  const [open, setOpen] = useState(false);
  const platform = PLATFORM_META[log.platform ?? ''] ?? {
    label: log.platform ?? '?', chip: BADGE_TONES.neutral,
  };
  const level = LEVEL_META[log.level] ?? LEVEL_META.error;
  const context = prettyContext(log.context);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative w-full text-left px-3 pl-4 py-2.5 flex flex-col gap-1.5 cursor-pointer hover:bg-white/[0.03] transition-colors"
        aria-expanded={open}
        title={open ? 'Masquer le détail' : 'Voir le détail'}
      >
        <Strip color={level.dot} row />
        <div className="flex items-center gap-2 flex-wrap text-[12px]">
          <span className={`inline-flex items-center gap-1 font-semibold ${level.text}`}>
            <Icon icon={level.icon} className="w-4 h-4" aria-hidden />
            {level.label}
          </span>
          <span className={`${BADGE} ${platform.chip}`}>
            {platform.label}
          </span>
          <span className={`${badge('neutral')} font-mono`} title="Partie de l'app qui a remonté le log">
            {log.source}
          </span>
          {log.app_version && <span className="font-mono text-white/55" title="Version de l'app">v{log.app_version}</span>}
          <span className="ml-auto font-mono text-white/50 tabular-nums">{formatDate(log.created_at)}</span>
          <Icon icon="mdi:chevron-down" className={`w-4 h-4 text-white/45 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </div>
        <p className={`text-[13px] leading-snug break-words ${level.text}`}>{log.message}</p>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3">
          {context && (
            <div>
              <p className="text-[12px] font-medium text-white/55 mb-1">Détails techniques</p>
              <pre className="text-[12px] leading-relaxed font-mono text-white/80 bg-black/25 border border-white/[0.06] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words">
                {context}
              </pre>
            </div>
          )}
          {log.user_agent && (
            <div>
              <p className="text-[12px] font-medium text-white/55 mb-1">Appareil / navigateur</p>
              <p className="font-mono text-[12px] text-white/60 break-all">{log.user_agent}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Logs remontés par l'app (iOS, Android, web) via `reportClientLog` :
 * échecs premium avec l'erreur RevenueCat exacte, exceptions JS non gérées.
 * Clic sur une ligne = détail (contexte JSON, user-agent).
 */
export const LogsPanel = ({ active, refreshKey }: { active: boolean; refreshKey: number }) => {
  const showToast = useToast();
  const fetcher = useCallback(() => fetchClientLogs(), []);
  const { data, isLoading, lastFetch, setData } = useAdminResource<ClientLog[]>({
    fetcher,
    active,
    refreshMs: LOGS_REFRESH_MS,
    refreshKey,
  });
  const logs = useMemo(() => data ?? [], [data]);
  const [platformFilter, setPlatformFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (platformFilter && l.platform !== platformFilter) return false;
      if (!q) return true;
      return l.message.toLowerCase().includes(q)
        || l.source.toLowerCase().includes(q)
        || (l.context ?? '').toLowerCase().includes(q);
    });
  }, [logs, platformFilter, search]);

  const handleClear = async () => {
    setConfirmClear(false);
    try {
      const deleted = await clearClientLogs();
      setData([]);
      showToast(`${deleted} log${deleted > 1 ? 's' : ''} supprimé${deleted > 1 ? 's' : ''}`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Une erreur est survenue, réessaie.', 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-2">
        <SearchField value={search} onChange={setSearch} placeholder="Rechercher : message, source, code d'erreur" />

        <div className="flex items-center gap-2 flex-wrap">
          <Segmented
            ariaLabel="Plateforme"
            value={platformFilter}
            onChange={setPlatformFilter}
            options={[
              { value: '', label: 'Toutes' },
              ...Object.entries(PLATFORM_META).map(([value, { label }]) => ({ value, label })),
            ]}
          />

          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            disabled={logs.length === 0}
            className={btn('danger', 'sm')}
          >
            <Icon icon="mdi:trash-can-outline" className="w-4 h-4" aria-hidden />
            Effacer les logs
          </button>

          <span className="text-[12px] text-white/50 whitespace-nowrap tabular-nums">
            {filtered.length === logs.length ? `${logs.length} log${logs.length > 1 ? 's' : ''}` : `${filtered.length} sur ${logs.length} logs`}
            {' · '}
            {lastFetch ? 'actualisé toutes les 10 s' : 'chargement…'}
          </span>
        </div>
      </div>

      {isLoading && logs.length === 0 ? (
        <LoadingState label="Chargement des logs…" />
      ) : filtered.length === 0 ? (
        logs.length === 0 ? (
          <EmptyState
            icon="mdi:check-circle-outline"
            title="Aucun log pour l'instant"
            hint="Dès qu'un appareil de joueur remonte un plantage ou une erreur, il apparaît ici (actualisé toutes les 10 s)."
          />
        ) : (
          <EmptyState
            icon="mdi:magnify"
            title="Aucun log ne correspond"
            hint="Essaie un autre mot, ou une autre plateforme."
          />
        )
      ) : (
        <div className={`${PANEL} overflow-hidden divide-y divide-white/[0.06]`}>
          {filtered.map((log) => <LogRow key={log.id} log={log} />)}
        </div>
      )}

      {confirmClear && (
        <ConfirmDialog
          title="Effacer tous les logs ?"
          message={`${logs.length} log${logs.length > 1 ? 's' : ''} ${logs.length > 1 ? 'seront effacés' : 'sera effacé'} définitivement, impossible de revenir en arrière.`}
          confirmLabel="Effacer"
          onConfirm={handleClear}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </div>
  );
};
