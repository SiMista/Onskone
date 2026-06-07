import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { TIERS } from '../../../constants/tiers';
import { buildShareCard } from '../../../utils/shareCard';
import { fr } from '../../../i18n/fr';
import { SectionHeader } from './SectionHeader';
import { TIER_TEXTS, PREVIEW_TOP_PLAYERS } from './shared';

export const TiersSection = () => {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [messageIdx, setMessageIdx] = useState(0);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const [previewMessageIdx, setPreviewMessageIdx] = useState(0);
  const [openAll, setOpenAll] = useState(true);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);

  const previewTier = previewIdx !== null ? TIERS[previewIdx] : null;
  const previewTexts = previewIdx !== null ? TIER_TEXTS[previewIdx] : null;

  const openPreview = (idx: number, msgIdx: number) => {
    setPreviewIdx(idx);
    setPreviewMessageIdx(msgIdx);
  };

  useEffect(() => {
    if (!previewTier || !previewTexts) {
      setShareUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
      return;
    }
    let cancelled = false;
    let url: string | null = null;
    setShareLoading(true);
    const msg = previewTexts.messages[previewMessageIdx] ?? previewTexts.messages[0];
    buildShareCard({
      pct: previewTier.midPct,
      verdictTitle: previewTexts.title,
      verdictMessage: msg,
      color: previewTier.color,
      tierEmoji: previewTier.emoji,
      topPlayers: PREVIEW_TOP_PLAYERS,
      texts: fr.shareCard,
    })
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setShareUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        setShareLoading(false);
      })
      .catch((err) => {
        console.error('buildShareCard preview failed', err);
        setShareLoading(false);
      });
    return () => { cancelled = true; };
  }, [previewTier, previewTexts, previewMessageIdx]);

  return (
    <div>
      <SectionHeader title="Paliers de score" count={TIERS.length} />
      <p className="text-[13px] text-white/55 mb-3 max-w-2xl">
        Le verdict affiché en fin de partie selon le pourcentage de l'équipe. Un message est tiré au sort dans la liste du palier atteint. <span className="text-amber-200/80">Clique sur "Aperçu"</span> pour voir la ShareCard générée.
      </p>
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={() => setOpenAll((v) => !v)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-white/75 hover:text-white font-mono text-[11px] uppercase tracking-wider transition-colors"
        >
          <Icon
            icon={openAll ? 'mdi:unfold-less-horizontal' : 'mdi:unfold-more-horizontal'}
            className="w-3.5 h-3.5"
          />
          {openAll ? 'Tout fermer' : 'Tout ouvrir'}
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* Mobile: aperçu en haut si sélection */}
        {previewTier && (
          <div className="lg:hidden order-first rounded-xl surface-glass p-4">
            <div className="flex items-center gap-2 mb-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">
                Aperçu ShareCard
              </p>
              <span className="ml-auto font-mono text-[14px] tabular-nums font-bold" style={{ color: previewTier.color }}>
                {previewTier.midPct}%
              </span>
              <button
                type="button"
                onClick={() => setPreviewIdx(null)}
                className="w-6 h-6 rounded-md border border-white/10 bg-white/[0.04] hover:bg-white/[0.1] text-white/55 hover:text-white flex items-center justify-center text-[12px] transition-colors"
                aria-label="Fermer l'aperçu"
                title="Fermer l'aperçu"
              >✕</button>
            </div>
            <div className="rounded-lg border border-white/[0.08] bg-[#0a0c12] p-2 flex items-center justify-center">
              {shareUrl ? (
                <img
                  src={shareUrl}
                  alt={`Aperçu ${previewTexts?.title ?? ''}`}
                  className="block w-full max-w-[260px] aspect-[9/16] object-contain rounded-md"
                />
              ) : (
                <div className="w-full max-w-[260px] aspect-[9/16] flex items-center justify-center text-white/40 font-mono text-xs">
                  {shareLoading ? 'Génération…' : '—'}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2.5">
          {TIERS.map((tier, idx) => {
            const prev = idx === 0 ? 0 : TIERS[idx - 1].max + 1;
            const isExpanded = expandedIdx === idx;
            const isPreviewed = previewIdx === idx;
            const isOpen = openAll || isExpanded;
            const localMessageIdx = isExpanded ? messageIdx : 0;
            const tierTitle = TIER_TEXTS[idx]?.title ?? '';
            const tierMessages = TIER_TEXTS[idx]?.messages ?? [];
            return (
              <div
                key={idx}
                className={`rounded-lg border bg-slate-400/[0.10] overflow-hidden transition-colors ${isPreviewed ? 'border-amber-300/40' : 'border-white/[0.07]'}`}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (openAll) {
                      setExpandedIdx(idx);
                      setMessageIdx(0);
                    } else if (isExpanded) {
                      setExpandedIdx(null);
                    } else {
                      setExpandedIdx(idx);
                      setMessageIdx(0);
                    }
                  }}
                  className={`w-full relative px-4 py-3 flex items-center gap-3 text-left hover:bg-white/[0.03] transition-colors cursor-pointer ${isOpen ? 'border-b border-white/[0.05]' : ''}`}
                >
                  <div
                    aria-hidden
                    className="absolute left-0 top-0 bottom-0 w-[3px]"
                    style={{ backgroundColor: tier.color }}
                  />
                  <Icon
                    icon="mdi:chevron-right"
                    className={`w-4 h-4 shrink-0 text-white/45 transition-transform ${isOpen ? 'rotate-90 text-amber-300' : ''}`}
                  />
                  <Icon icon={tier.icon} className="w-7 h-7 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold tracking-tight text-white truncate">
                      {tierTitle}
                    </p>
                    <p className="text-[12px] text-white/45">
                      de {prev}% à {tier.max}%
                    </p>
                  </div>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      openPreview(idx, localMessageIdx);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        openPreview(idx, localMessageIdx);
                      }
                    }}
                    className={`font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${isPreviewed ? 'text-amber-200 bg-amber-400/10 border-amber-300/40' : 'text-white/55 hover:text-amber-200 border-white/15 hover:border-amber-300/40 hover:bg-amber-400/5'}`}
                    title="Générer l'aperçu ShareCard"
                  >
                    aperçu
                  </span>
                  <span
                    aria-hidden
                    className="w-5 h-5 rounded-full border border-white/15 shrink-0"
                    style={{ backgroundColor: tier.color }}
                  />
                </button>
                {isOpen && (
                  <ol className="px-4 py-3 space-y-1.5 animate-fade-in">
                    {tierMessages.map((m, i) => {
                      const messageActive = isExpanded && messageIdx === i;
                      return (
                        <li key={i}>
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedIdx(idx);
                              setMessageIdx(i);
                            }}
                            className={`w-full flex gap-2 text-[13px] leading-snug text-left rounded px-1 py-0.5 transition-colors cursor-pointer ${messageActive ? 'bg-amber-400/10 text-amber-100' : 'text-white/85 hover:bg-white/[0.03]'}`}
                            title="Sélectionner ce message (clique sur Aperçu pour le générer)"
                          >
                            <span className={`font-mono text-[11px] tabular-nums mt-0.5 shrink-0 w-5 text-right ${messageActive ? 'text-amber-300' : 'text-white/25'}`}>
                              {i + 1}.
                            </span>
                            <span className="whitespace-pre-wrap break-words">{m}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            );
          })}
        </div>

        {/* Sticky preview - desktop */}
        <aside className="hidden lg:block">
          <div className="sticky top-[180px]">
            <div className="rounded-xl surface-glass p-4">
              <div className="flex items-center gap-2 mb-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">
                  Aperçu ShareCard
                </p>
                {previewTier && (
                  <button
                    type="button"
                    onClick={() => setPreviewIdx(null)}
                    className="ml-auto w-6 h-6 rounded-md border border-white/10 bg-white/[0.04] hover:bg-white/[0.1] text-white/55 hover:text-white flex items-center justify-center text-[12px] transition-colors"
                    aria-label="Fermer l'aperçu"
                    title="Fermer l'aperçu"
                  >✕</button>
                )}
              </div>
              {previewTier ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-white/[0.08] bg-[#0a0c12] p-2 flex items-center justify-center">
                    {shareUrl ? (
                      <img
                        src={shareUrl}
                        alt={`Aperçu ${previewTexts?.title ?? ''}`}
                        className="block w-full max-w-[260px] aspect-[9/16] object-contain rounded-md"
                      />
                    ) : (
                      <div className="w-full max-w-[260px] aspect-[9/16] flex items-center justify-center text-white/40 font-mono text-xs">
                        {shareLoading ? 'Génération…' : '—'}
                      </div>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-white/35">à</span>
                    <span className="font-mono text-[14px] tabular-nums font-bold" style={{ color: previewTier.color }}>
                      {previewTier.midPct}%
                    </span>
                    <span className="ml-auto font-mono text-[10px] text-white/35">
                      message {previewMessageIdx + 1}/{previewTexts?.messages.length ?? 0}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-center py-10 font-mono text-[11px] uppercase tracking-[0.22em] text-white/30">
                  clique sur "Aperçu" d'un palier
                </p>
              )}
            </div>
          </div>
        </aside>

      </div>
    </div>
  );
};
