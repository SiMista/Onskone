import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { TIERS } from '../../../constants/tiers';
import { buildShareCard } from '../../../utils/shareCard';
import { fr } from '../../../i18n/fr';
import { SectionHeader } from './SectionHeader';
import { TIER_TEXTS, PREVIEW_TOP_PLAYERS } from './shared';
import { PANEL, btn, iconBtn } from '../ui';

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
      <SectionHeader title="Paliers de score" />
      <p className="text-[13px] text-white/55 mb-4 max-w-2xl">
        Le verdict affiché en fin de partie selon le score de l'équipe (en %). Un message est tiré au sort dans la liste du palier atteint. <span className="text-amber-200/80">Clique sur « Aperçu »</span> pour voir l'image de partage générée, celle que les joueurs partagent en fin de partie.
      </p>
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={() => setOpenAll((v) => !v)}
          className={btn('secondary', 'sm')}
        >
          <Icon
            icon={openAll ? 'mdi:unfold-less-horizontal' : 'mdi:unfold-more-horizontal'}
            className="w-4 h-4"
            aria-hidden
          />
          {openAll ? 'Tout fermer' : 'Tout ouvrir'}
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* Mobile: aperçu en haut si sélection */}
        {previewTier && (
          <div className={`lg:hidden order-first ${PANEL} p-4`}>
            <div className="flex items-center gap-2 mb-3">
              <p className="text-[14px] font-semibold text-white/85">
                Aperçu de l'image de partage
              </p>
              <span className="ml-auto text-[14px] tabular-nums font-bold" style={{ color: previewTier.color }} title="Score simulé">
                {previewTier.midPct}%
              </span>
              <button
                type="button"
                onClick={() => setPreviewIdx(null)}
                className={iconBtn()}
                aria-label="Fermer l'aperçu"
                title="Fermer l'aperçu"
              >
                <Icon icon="mdi:close" className="w-4 h-4" aria-hidden />
              </button>
            </div>
            <div className="rounded-lg bg-black/25 border border-white/[0.06] p-2 flex items-center justify-center">
              {shareUrl ? (
                <img
                  src={shareUrl}
                  alt={`Aperçu ${previewTexts?.title ?? ''}`}
                  className="block w-full max-w-[260px] aspect-[9/16] object-contain rounded-md"
                />
              ) : (
                <div className="w-full max-w-[260px] aspect-[9/16] flex items-center justify-center text-white/55 text-[13px]">
                  {shareLoading ? 'Génération…' : 'Aperçu indisponible'}
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
                className={`${PANEL} overflow-hidden ${isPreviewed ? 'outline -outline-offset-1 outline-amber-300/50' : ''}`}
              >
                <div className={`relative flex items-center gap-2 pr-3 ${isOpen ? 'border-b border-white/[0.06]' : ''}`}>
                  <div
                    aria-hidden
                    className="absolute left-0 top-0 bottom-0 w-[3px]"
                    style={{ backgroundColor: tier.color }}
                  />
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
                    aria-expanded={isOpen}
                    className="flex-1 min-w-0 pl-4 py-3 flex items-center gap-3 text-left hover:bg-white/[0.03] transition-colors cursor-pointer"
                  >
                    <Icon
                      icon="mdi:chevron-right"
                      className={`w-4 h-4 shrink-0 text-white/45 transition-transform ${isOpen ? 'rotate-90 text-amber-300' : ''}`}
                      aria-hidden
                    />
                    <Icon icon={tier.icon} className="w-7 h-7 shrink-0" aria-hidden />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14px] font-semibold tracking-tight text-white truncate">
                        {tierTitle}
                      </span>
                      <span className="block text-[12px] text-white/60">
                        de {prev}% à {tier.max}%
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openPreview(idx, localMessageIdx)}
                    aria-pressed={isPreviewed}
                    className={`${btn(isPreviewed ? 'primary' : 'secondary', 'sm')} shrink-0`}
                    title="Générer l'image de partage de ce palier"
                  >
                    Aperçu
                  </button>
                  <span
                    aria-hidden
                    className="w-5 h-5 rounded-full border border-white/15 shrink-0"
                    style={{ backgroundColor: tier.color }}
                  />
                </div>
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
                            aria-pressed={messageActive}
                            className={`w-full flex gap-2 text-[13px] leading-snug text-left rounded-md px-1.5 py-1 transition-colors cursor-pointer ${messageActive ? 'bg-amber-400/15 text-amber-100 font-medium' : 'text-white/85 hover:bg-white/[0.04]'}`}
                            title="Choisir ce message pour l'aperçu (puis clique sur « Aperçu »)"
                          >
                            <span className={`text-[12px] tabular-nums shrink-0 w-5 text-right ${messageActive ? 'text-amber-300' : 'text-white/45'}`}>
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
            <div className={`${PANEL} p-4`}>
              <div className="flex items-center gap-2 mb-3">
                <p className="text-[14px] font-semibold text-white/85">
                  Aperçu de l'image de partage
                </p>
                {previewTier && (
                  <button
                    type="button"
                    onClick={() => setPreviewIdx(null)}
                    className={`${iconBtn()} ml-auto`}
                    aria-label="Fermer l'aperçu"
                    title="Fermer l'aperçu"
                  >
                    <Icon icon="mdi:close" className="w-4 h-4" aria-hidden />
                  </button>
                )}
              </div>
              {previewTier ? (
                <div className="space-y-3">
                  <div className="rounded-lg bg-black/25 border border-white/[0.06] p-2 flex items-center justify-center">
                    {shareUrl ? (
                      <img
                        src={shareUrl}
                        alt={`Aperçu ${previewTexts?.title ?? ''}`}
                        className="block w-full max-w-[260px] aspect-[9/16] object-contain rounded-md"
                      />
                    ) : (
                      <div className="w-full max-w-[260px] aspect-[9/16] flex items-center justify-center text-white/55 text-[13px]">
                        {shareLoading ? 'Génération…' : 'Aperçu indisponible'}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-center py-10 px-2 text-[13px] text-white/55">
                  Clique sur « Aperçu » d'un palier pour générer son image de partage.
                </p>
              )}
            </div>
          </div>
        </aside>

      </div>
    </div>
  );
};
