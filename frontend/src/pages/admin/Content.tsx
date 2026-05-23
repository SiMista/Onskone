import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { GAME_CONSTANTS } from '@onskone/shared';
import { TIERS } from '../EndGame';
import { FUN_FACTS } from '../../constants/funFacts';
import { ACHIEVEMENTS } from '../../utils/playerStats';
import { AVATARS, getAvatarUrl } from '../../constants/game';
import { LEGAL_CONTENT } from '../../constants/legal';
import { buildShareCard } from '../../utils/shareCard';

const PREVIEW_TOP_PLAYERS = [
  { name: 'Simi', score: 8, avatarId: 3 },
  { name: 'Léa', score: 6, avatarId: 9 },
  { name: 'Thomas', score: 5, avatarId: 16 },
];

type ContentSection = 'tiers' | 'funfacts' | 'achievements' | 'avatars' | 'legal' | 'constants';

const CONTENT_SECTIONS: { id: ContentSection; label: string; hint: string }[] = [
  { id: 'tiers', label: 'Paliers de score', hint: 'verdict de fin de partie' },
  { id: 'funfacts', label: 'Saviez-vous', hint: 'faits insolites' },
  { id: 'achievements', label: 'Succès', hint: 'badges du joueur' },
  { id: 'avatars', label: 'Avatars', hint: 'galerie' },
  { id: 'legal', label: 'Légal', hint: 'pages publiques' },
  { id: 'constants', label: 'Réglages', hint: 'durées & limites' },
];

const PHASE_LABELS_FR: Record<string, string> = {
  QUESTION_SELECTION: 'Sélection de la question',
  SUBSTITUTE_SELECTION: 'Sélection du devineur de pilier',
  ANSWERING: 'Réponse des joueurs',
  SUBSTITUTE_ANSWERING: 'Réponse du devineur de pilier',
  GUESSING: 'Devinette',
};

const SectionHeader = ({ title, hint, count }: { title: string; hint?: string; count?: number }) => (
  <div className="flex items-baseline gap-2.5 mb-3">
    <h2 className="text-[18px] font-semibold tracking-tight text-white">{title}</h2>
    {typeof count === 'number' && (
      <span className="font-mono text-[11px] tabular-nums text-white/40 px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/10">
        {count}
      </span>
    )}
    {hint && (
      <span className="text-[12px] text-white/35 ml-auto italic">
        {hint}
      </span>
    )}
  </div>
);

const TiersSection = () => {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [messageIdx, setMessageIdx] = useState(0);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const [previewMessageIdx, setPreviewMessageIdx] = useState(0);
  const [openAll, setOpenAll] = useState(true);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);

  const previewTier = previewIdx !== null ? TIERS[previewIdx] : null;

  const openPreview = (idx: number, msgIdx: number) => {
    setPreviewIdx(idx);
    setPreviewMessageIdx(msgIdx);
  };

  useEffect(() => {
    if (!previewTier) {
      setShareUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
      return;
    }
    let cancelled = false;
    let url: string | null = null;
    setShareLoading(true);
    const msg = previewTier.messages[previewMessageIdx] ?? previewTier.messages[0];
    buildShareCard({
      pct: previewTier.midPct,
      verdictTitle: previewTier.title,
      verdictMessage: msg,
      color: previewTier.color,
      tierEmoji: previewTier.emoji,
      topPlayers: PREVIEW_TOP_PLAYERS,
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
  }, [previewTier, previewMessageIdx]);

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
                  alt={`Aperçu ${previewTier.title}`}
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
                      {tier.title}
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
                    {tier.messages.map((m, i) => {
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
                        alt={`Aperçu ${previewTier.title}`}
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
                      message {previewMessageIdx + 1}/{previewTier.messages.length}
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

const FunFactsSection = () => (
  <div>
    <SectionHeader title="Saviez-vous" count={FUN_FACTS.length} />
    <p className="text-[13px] text-white/55 mb-4 max-w-2xl">
      Affichés en rotation pendant les phases d'attente pour faire patienter les joueurs.
    </p>
    <div className="rounded-lg surface-glass overflow-hidden">
      <ol>
        {FUN_FACTS.map((f, i) => (
          <li
            key={i}
            className="flex gap-3 px-4 py-2.5 border-b border-white/[0.04] last:border-b-0 text-[13px] text-white/85 leading-snug"
          >
            <span className="font-mono text-[11px] tabular-nums text-white/30 shrink-0 w-6 text-right mt-0.5">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="whitespace-pre-wrap break-words">{f}</span>
          </li>
        ))}
      </ol>
    </div>
  </div>
);

const AchievementsSection = () => (
  <div>
    <SectionHeader title="Succès" count={ACHIEVEMENTS.length} />
    <p className="text-[13px] text-white/55 mb-4 max-w-2xl">
      Badges débloqués par le joueur en fin de partie, sauvegardés sur son appareil.
    </p>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
      {ACHIEVEMENTS.map((a) => (
        <div
          key={a.id}
          className="rounded-lg surface-glass p-3 flex items-start gap-3"
        >
          <Icon icon={a.icon} className="w-9 h-9 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-white truncate">{a.title}</p>
            <p className="text-[12.5px] text-white/65 leading-snug mt-0.5">
              {a.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const AvatarsSection = () => (
  <div>
    <SectionHeader title="Avatars" count={AVATARS.length} />
    <p className="text-[13px] text-white/55 mb-4 max-w-2xl">
      Le casting visuel disponible pour les joueurs.
    </p>
    <div className="grid grid-cols-4 md:grid-cols-7 gap-2.5">
      {AVATARS.map((a) => (
        <div
          key={a.id}
          className="rounded-lg surface-glass overflow-hidden"
        >
          <div className="aspect-square bg-black/30 flex items-center justify-center">
            <img
              src={getAvatarUrl(a.id)}
              alt={`Avatar ${a.id + 1}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
          <div className="px-2 py-1.5 border-t border-white/[0.05] flex items-center justify-between">
            <span className="text-[12px] text-white/65">Avatar {a.id + 1}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const LEGAL_LABELS_FR: Record<string, string> = {
  about: 'À propos',
  mentions: 'Mentions légales',
  privacy: 'Politique de confidentialité',
  contact: 'Nous contacter',
};

const LegalSection = () => {
  const entries = Object.entries(LEGAL_CONTENT) as Array<[
    keyof typeof LEGAL_CONTENT,
    typeof LEGAL_CONTENT[keyof typeof LEGAL_CONTENT],
  ]>;
  const [openKey, setOpenKey] = useState<string | null>(null);
  return (
    <div>
      <SectionHeader title="Contenu légal" count={entries.length} />
      <p className="text-[13px] text-white/55 mb-4 max-w-2xl">
        Textes affichés depuis le pied de page du site : À propos, Mentions légales, Confidentialité et Contact.
      </p>
      <div className="space-y-3">
        {entries.map(([key, block]) => {
          const sections = 'sections' in block ? block.sections : [];
          const isOpen = openKey === key;
          return (
            <div
              key={key}
              className="rounded-lg surface-glass overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setOpenKey(isOpen ? null : key)}
                aria-expanded={isOpen}
                className={`w-full px-4 py-2.5 flex items-center gap-2 text-left hover:bg-white/[0.03] transition-colors ${isOpen ? 'border-b border-white/[0.05]' : ''}`}
              >
                <svg
                  className={`w-3.5 h-3.5 text-white/50 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clipRule="evenodd" />
                </svg>
                <p className="text-[15px] font-semibold tracking-tight text-white">
                  {LEGAL_LABELS_FR[key] ?? block.title}
                </p>
                {sections.length > 0 && (
                  <span className="ml-auto text-[12px] text-white/40">
                    {sections.length} rubrique{sections.length > 1 ? 's' : ''}
                  </span>
                )}
              </button>
              {!isOpen ? null : sections.length === 0 ? (
                <p className="px-4 py-3 text-[12.5px] text-white/40 italic">
                  Aucun texte (la page renvoie vers un formulaire de contact).
                </p>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {sections.map((s, i) => (
                    <div key={i} className="px-4 py-3">
                      <p className="text-[13px] font-semibold text-amber-200/90 mb-1.5">
                        {s.title}
                      </p>
                      <div
                        className="text-[13px] text-white/80 leading-relaxed [&_a]:text-sky-300 [&_a]:underline [&_strong]:text-white"
                        dangerouslySetInnerHTML={{ __html: s.content }}
                      />
                      {'list' in s && Array.isArray(s.list) && (
                        <ul className="mt-2 space-y-1">
                          {s.list.map((li, j) => (
                            <li key={j} className="flex gap-2 text-[12.5px] text-white/70 leading-snug">
                              <span className="text-white/30 shrink-0">·</span>
                              <span>{li}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {'extra' in s && s.extra && (
                        <div
                          className="mt-2 text-[12.5px] text-white/60 leading-snug [&_a]:text-sky-300 [&_a]:underline"
                          dangerouslySetInnerHTML={{ __html: s.extra }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ConstantsSection = () => {
  const timers = GAME_CONSTANTS.TIMERS;
  const [guessPlayers, setGuessPlayers] = useState(3);
  const guessSeconds = 120 + Math.max(0, guessPlayers - 3) * 20;
  const toMinSec = (s: number): string | null => {
    if (s < 60) return null;
    const m = Math.floor(s / 60);
    const r = s % 60;
    return r === 0 ? `${m} min` : `${m} min ${r} s`;
  };
  return (
    <div>
      <SectionHeader title="Réglages de jeu" />
      <p className="text-[13px] text-white/55 mb-4 max-w-2xl">
        Les durées de chaque phase et les limites appliquées aux parties.
      </p>

      <div className="space-y-4">
        <div>
          <p className="text-[12px] uppercase tracking-[0.18em] text-white/40 mb-2 font-semibold">
            Durée de chaque phase
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {Object.entries(timers).map(([phase, seconds]) => {
              const isGuessing = phase === 'GUESSING';
              return (
                <div
                  key={phase}
                  className="rounded-lg surface-glass p-3"
                >
                  <p className="text-[12px] text-white/55">
                    {PHASE_LABELS_FR[phase] ?? phase}
                  </p>
                  {isGuessing ? (
                    <>
                      <p className="mt-1 text-[20px] font-semibold tabular-nums text-white">
                        {guessSeconds} secondes
                        {toMinSec(guessSeconds) && (
                          <span className="ml-2 text-[13px] font-normal text-white/40">
                            ({toMinSec(guessSeconds)})
                          </span>
                        )}
                      </p>
                      <p className="text-[12px] text-white/55 mt-0.5">
                        120 s + 20 s par joueur au-delà de 3
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          id="guess-slider"
                          type="range"
                          min={GAME_CONSTANTS.MIN_PLAYERS}
                          max={GAME_CONSTANTS.MAX_PLAYERS}
                          step={1}
                          value={guessPlayers}
                          onChange={(e) => setGuessPlayers(Number(e.target.value))}
                          aria-label="Simuler le nombre de joueurs"
                          className="admin-mini-slider flex-1 cursor-pointer"
                        />
                        <span className="text-[10px] tabular-nums text-white/45 w-14 text-right">
                          {guessPlayers} joueur{guessPlayers > 1 ? 's' : ''}
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="mt-1 text-[20px] font-semibold tabular-nums text-white">
                      {seconds} secondes
                      {toMinSec(seconds) && (
                        <span className="ml-2 text-[13px] font-normal text-white/40">
                          ({toMinSec(seconds)})
                        </span>
                      )}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-[12px] uppercase tracking-[0.18em] text-white/40 mb-2 font-semibold">
            Limites
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {[
              { label: 'Nombre de joueurs', value: `${GAME_CONSTANTS.MIN_PLAYERS} à ${GAME_CONSTANTS.MAX_PLAYERS}` },
              { label: 'Longueur du pseudo', value: `${GAME_CONSTANTS.MIN_NAME_LENGTH} à ${GAME_CONSTANTS.MAX_NAME_LENGTH} caractères` },
              { label: 'Longueur d\'une réponse', value: `${GAME_CONSTANTS.MAX_ANSWER_LENGTH} caractères max` },
              { label: 'Avatars disponibles', value: `${GAME_CONSTANTS.AVATAR_COUNT}` },
              { label: 'Relances par carte', value: `${GAME_CONSTANTS.DEFAULT_CARD_RELANCES}` },
              { label: 'Longueur du code de salon', value: `${GAME_CONSTANTS.LOBBY_CODE_LENGTH} caractères` },
            ].map((row) => (
              <div
                key={row.label}
                className="rounded-lg surface-glass p-3"
              >
                <p className="text-[12px] text-white/55">
                  {row.label}
                </p>
                <p className="mt-1 text-[16px] font-semibold tabular-nums text-white">
                  {row.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const ContentPanel = () => {
  const [section, setSection] = useState<ContentSection>('tiers');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-1.5">
        {CONTENT_SECTIONS.map((s) => {
          const active = section === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`px-2.5 py-1.5 sm:py-1 rounded-md border font-mono text-[11px] uppercase tracking-wider transition-colors ${active
                ? 'bg-white/[0.08] border-white/15 text-white'
                : 'bg-transparent border-white/[0.06] text-white/45 hover:text-white/85 hover:border-white/15'
                }`}
              title={s.hint}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <div>
        {section === 'tiers' && <TiersSection />}
        {section === 'funfacts' && <FunFactsSection />}
        {section === 'achievements' && <AchievementsSection />}
        {section === 'avatars' && <AvatarsSection />}
        {section === 'legal' && <LegalSection />}
        {section === 'constants' && <ConstantsSection />}
      </div>
    </div>
  );
};
