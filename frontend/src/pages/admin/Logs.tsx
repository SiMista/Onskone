import { useCallback, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { useToast } from '../../components/Toast';
import { useAdminResource } from '../../hooks';
import { ClientLog, clearClientLogs, fetchClientLogs } from '../../utils/adminDataApi';
import { CLUSTER } from './shared';
import { ConfirmDialog } from './ConfirmDialog';

const LOGS_REFRESH_MS = 10000;

const PLATFORM_META: Record<string, { label: string; chip: string }> = {
  ios: { label: 'iOS', chip: 'bg-sky-400/10 border-sky-300/40 text-sky-100' },
  android: { label: 'Android', chip: 'bg-emerald-400/10 border-emerald-300/40 text-emerald-100' },
  web: { label: 'Web', chip: 'bg-white/[0.05] border-white/15 text-white/70' },
};

const LEVEL_META: Record<ClientLog['level'], { dot: string; text: string }> = {
  error: { dot: 'bg-rose-400', text: 'text-rose-200' },
  warn: { dot: 'bg-amber-400', text: 'text-amber-200' },
  info: { dot: 'bg-white/40', text: 'text-white/70' },
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
    label: log.platform ?? '?', chip: 'bg-white/[0.05] border-white/15 text-white/60',
  };
  const level = LEVEL_META[log.level] ?? LEVEL_META.error;
  const context = prettyContext(log.context);

  return (
    <div className="rounded-lg surface-glass surface-glass-hover transition-colors">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left p-3 flex flex-col gap-1.5 cursor-pointer"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 flex-wrap font-mono text-[11px]">
          <span className={`w-1.5 h-1.5 rounded-full ${level.dot}`} aria-hidden />
          <span className={`px-1.5 py-0.5 rounded border uppercase tracking-wider ${platform.chip}`}>
            {platform.label}
          </span>
          <span className="px-1.5 py-0.5 rounded border border-white/15 bg-white/[0.04] text-white/75">
            {log.source}
          </span>
          {log.app_version && <span className="text-white/40">v{log.app_version}</span>}
          <span className="ml-auto text-white/35 tabular-nums">{formatDate(log.created_at)}</span>
        </div>
        <p className={`text-[13px] leading-snug break-words ${level.text}`}>{log.message}</p>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          {context && (
            <pre className="text-[11px] leading-relaxed font-mono text-white/80 bg-black/40 border border-white/[0.06] rounded-md p-2.5 overflow-x-auto whitespace-pre-wrap break-words">
              {context}
            </pre>
          )}
          {log.user_agent && (
            <p className="font-mono text-[10px] text-white/30 break-all">{log.user_agent}</p>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Erreurs remontées par l'app (iOS, Android, web) via `reportClientLog` :
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
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-2 md:gap-2.5">
        <div className={`${CLUSTER} w-full md:flex-1 md:min-w-[200px] md:max-w-md`}>
          <Icon icon="mdi:magnify" className="w-4 h-4 text-white/35 ml-0.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="rechercher (message, source, code d'erreur…)"
            className="flex-1 min-w-0 bg-transparent border-0 outline-0 text-[12px] text-white/85 placeholder:text-white/25 font-mono"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-white/30 hover:text-white text-[12px] px-1">×</button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className={CLUSTER}>
            {[['', 'Tout'], ['ios', 'iOS'], ['android', 'Android'], ['web', 'Web']].map(([value, label]) => (
              <button
                key={value || 'all'}
                onClick={() => setPlatformFilter(value)}
                className={`px-2 py-0.5 rounded font-mono text-[11px] uppercase tracking-wider transition-colors ${platformFilter === value
                  ? 'bg-amber-400/15 text-amber-100'
                  : 'text-white/45 hover:text-white/80'}`}
              >{label}</button>
            ))}
          </div>

          <button
            onClick={() => setConfirmClear(true)}
            disabled={logs.length === 0}
            className="px-2.5 py-1 rounded-md border border-rose-400/30 bg-rose-500/[0.06] text-rose-200 hover:bg-rose-500/15 disabled:opacity-40 disabled:cursor-not-allowed font-mono text-[11px] uppercase tracking-wider transition-colors"
          >Vider</button>

          <span className="font-mono text-[11px] text-white/30 whitespace-nowrap">
            {filtered.length}/{logs.length} · {lastFetch ? 'refresh 10s' : '…'}
          </span>
        </div>
      </div>

      {isLoading && logs.length === 0 ? (
        <div className="text-center py-20 font-mono text-[11px] uppercase tracking-[0.3em] text-white/30">
          chargement…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-white/30">
            {logs.length === 0 ? 'aucun log' : 'aucun résultat'}
          </p>
          {logs.length === 0 && (
            <p className="text-[12px] text-white/40">
              Les erreurs remontées par l'app (achat premium raté, exception JS…) apparaissent ici.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => <LogRow key={log.id} log={log} />)}
        </div>
      )}

      {confirmClear && (
        <ConfirmDialog
          title="Vider tous les logs ?"
          message={`${logs.length} log${logs.length > 1 ? 's' : ''} seront supprimés définitivement.`}
          confirmLabel="Vider"
          onConfirm={handleClear}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </div>
  );
};
