import { useEffect, useState } from 'react';
import Button from '../components/Button';
import { buildShareCard, shareBlob } from '../utils/shareCard';
import BackButton from '../components/BackButton';
import PseudoPlate from '../components/PseudoPlate';
import InfoModal from '../components/InfoModal';
import HowToPlaySteps from '../components/HowToPlaySteps';
import HowToPlayButton from '../components/HowToPlayButton';
import ConfirmModal from '../components/ConfirmModal';
import Modal from '../components/Modal';
import ReportModal from '../components/ReportModal';
import AboutModal from '../components/Footer/AboutModal';
import ContactModal from '../components/Footer/ContactModal';
import MentionsModal from '../components/Footer/MentionsModal';
import { useToast } from '../components/Toast';

// =====================================================================
// StudioGallery - design-system preview for the Studio
// =====================================================================
// Rendered inside the Studio page when the "Composants" tab is active.
// Goal: see the key reusable visuals side-by-side to spot inconsistencies.
// =====================================================================

type ButtonVariant = 'primary' | 'success' | 'danger' | 'warning' | 'secondary' | 'ghost' | 'quit';

const BUTTON_VARIANTS: ButtonVariant[] = ['primary', 'success', 'danger', 'warning', 'secondary', 'ghost', 'quit'];

const Section = ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) => (
  <section className="rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.03] to-white/[0.01] p-5">
    <header className="mb-4 flex items-baseline justify-between gap-3 border-b border-white/[0.05] pb-2.5">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-amber-200/90">{title}</h2>
      {subtitle && <span className="font-mono text-[10px] text-white/35">{subtitle}</span>}
    </header>
    {children}
  </section>
);

const Tile = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-2.5">
    <span className="font-mono text-[10px] uppercase tracking-wider text-white/35">{label}</span>
    <div className="rounded-xl border border-white/[0.06] bg-[#1a1d28] p-4 flex items-center justify-center min-h-[90px]">
      {children}
    </div>
  </div>
);

const CompactTile = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <span className="font-mono text-[9px] uppercase tracking-wider text-white/35 truncate">{label}</span>
    <div className="rounded-lg border border-white/[0.06] bg-[#1a1d28] px-2 py-2 flex items-center justify-center min-h-[52px]">
      {children}
    </div>
  </div>
);

const SHARE_PRESETS = [
  { label: '15% - gênant', pct: 15, title: "C'est gênant là...", message: "Vous partagez le wifi, c'est déjà une base solide.", color: '#ff4f4f' },
  { label: '35% - pas encore', pct: 35, title: 'Pas encore ça', message: 'Les bases sont là, reste juste à construire au-dessus.', color: '#ff8c3a' },
  { label: '55% - pas mal', pct: 55, title: 'Pas mal, pas mal', message: 'Un pas de plus et vous êtes une vraie team.', color: '#ffc700' },
  { label: '75% - super team', pct: 75, title: 'Super team', message: 'Vous vous captez presque sans parler, c\'est beau à voir.', color: '#8bd94d' },
  { label: '92% - inséparables', pct: 92, title: 'Inséparables', message: 'À ce stade c\'est plus de l\'amitié, c\'est de la famille.', color: '#30c94d' },
  { label: '100% - Onskoné !', pct: 100, title: 'Onskoné !', message: 'Score parfait. Vous êtes la même personne en plusieurs exemplaires.', color: '#b46cff' },
];

const SHARE_TOP_PLAYERS = [
  { name: 'Simi', score: 8, avatarId: 3 },
  { name: 'Léa', score: 6, avatarId: 9 },
  { name: 'Thomas', score: 5, avatarId: 16 },
];

const StudioGallery = () => {
  const showToast = useToast();
  const [pseudoValue, setPseudoValue] = useState('Simi');
  const [answerValue, setAnswerValue] = useState('');
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [genericOpen, setGenericOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [mentionsOpen, setMentionsOpen] = useState(false);
  const [shareIdx, setShareIdx] = useState(3);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const shareBlobRef = (useState<{ blob: Blob | null }>({ blob: null })[0]);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    setShareLoading(true);
    const preset = SHARE_PRESETS[shareIdx];
    buildShareCard({
      pct: preset.pct,
      verdictTitle: preset.title,
      verdictMessage: preset.message,
      color: preset.color,
      topPlayers: SHARE_TOP_PLAYERS,
    })
      .then(blob => {
        if (cancelled) return;
        shareBlobRef.blob = blob;
        url = URL.createObjectURL(blob);
        setShareUrl(prev => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        setShareLoading(false);
      })
      .catch(err => {
        console.error('buildShareCard preview failed', err);
        setShareLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [shareIdx, shareBlobRef]);

  const handleSharePreview = async () => {
    if (!shareBlobRef.blob) return;
    const preset = SHARE_PRESETS[shareIdx];
    const result = await shareBlob(shareBlobRef.blob, `${preset.title} - ${preset.pct}%`);
    if (result === 'copied') showToast('Image copiée !', 'success');
    else if (result === 'shared') showToast('Partagé ✓', 'success');
    else if (result === 'failed') showToast('Partage non supporté', 'warning');
  };

  const handleDownloadPreview = () => {
    if (!shareUrl) return;
    const a = document.createElement('a');
    a.href = shareUrl;
    a.download = `onskone-share-${SHARE_PRESETS[shareIdx].pct}.png`;
    a.click();
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl text-white tracking-tight">
          Galerie <span className="text-amber-300">/ composants</span>
        </h1>
        <p className="font-mono text-[11px] text-white/45">
          Aperçu live des éléments d'interface - utilise-le pour vérifier la cohérence visuelle avant un commit.
        </p>
      </div>

      {/* ====== Boutons : variantes ====== */}
      <Section title="Boutons - variantes" subtitle="size = md">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {BUTTON_VARIANTS.map((v) => (
            <Tile key={v} label={v}>
              <Button text={v} variant={v} />
            </Tile>
          ))}
        </div>
      </Section>

      {/* ====== Back button ====== */}
      <Section title="BackButton" subtitle="2 tons : neutre + danger">
        <div className="grid grid-cols-2 gap-4">
          <Tile label="neutral">
            <div className="bg-[#0a0c12] px-6 py-4 rounded-lg w-full">
              <BackButton label="Retour" />
            </div>
          </Tile>
          <Tile label="danger">
            <div className="bg-[#0a0c12] px-6 py-4 rounded-lg w-full">
              <BackButton label="Quitter le salon" tone="danger" />
            </div>
          </Tile>
        </div>
      </Section>

      {/* ====== Toasts ====== */}
      <Section title="Toasts" subtitle="clique pour déclencher un vrai toast">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Button text="info" variant="secondary" onClick={() => showToast('Une information utile', 'info')} />
          <Button text="success" variant="success" onClick={() => showToast('Action réussie ✓', 'success')} />
          <Button text="warning" variant="warning" onClick={() => showToast('Attention, vérifie ce point', 'warning')} />
          <Button text="error" variant="danger" onClick={() => showToast('Quelque chose a planté', 'error')} />
        </div>
      </Section>

      {/* ====== Modals ====== */}
      <Section title="Modales" subtitle="clique pour ouvrir chaque popup">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          <CompactTile label="InfoModal - Comment jouer">
            <Button text="Ouvrir" variant="primary" size="sm" onClick={() => setHowToPlayOpen(true)} />
          </CompactTile>
          <CompactTile label="ConfirmModal">
            <Button text="Ouvrir" variant="warning" size="sm" onClick={() => setConfirmOpen(true)} />
          </CompactTile>
          <CompactTile label="Modal (générique)">
            <Button text="Ouvrir" variant="secondary" size="sm" onClick={() => setGenericOpen(true)} />
          </CompactTile>
          <CompactTile label="ReportModal">
            <Button text="Ouvrir" variant="danger" size="sm" onClick={() => setReportOpen(true)} />
          </CompactTile>
          <CompactTile label="AboutModal">
            <Button text="Ouvrir" variant="ghost" size="sm" onClick={() => setAboutOpen(true)} />
          </CompactTile>
          <CompactTile label="ContactModal">
            <Button text="Ouvrir" variant="ghost" size="sm" onClick={() => setContactOpen(true)} />
          </CompactTile>
          <CompactTile label="MentionsModal">
            <Button text="Ouvrir" variant="ghost" size="sm" onClick={() => setMentionsOpen(true)} />
          </CompactTile>
          <CompactTile label="HowToPlayButton (déclencheur)">
            <HowToPlayButton onClick={() => setHowToPlayOpen(true)} />
          </CompactTile>
        </div>
      </Section>

      <InfoModal isOpen={howToPlayOpen} onClose={() => setHowToPlayOpen(false)} title="Comment jouer ?">
        <HowToPlaySteps />
      </InfoModal>
      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => showToast('Confirmé ✓', 'success')}
        title="Confirmer l'action ?"
        message="Ceci est un exemple de modale de confirmation. Le bouton primaire valide, le secondaire annule."
        confirmText="Oui, vas-y"
        cancelText="Annuler"
        confirmVariant="danger"
      />
      <Modal isOpen={genericOpen} onClose={() => setGenericOpen(false)} title="Modale générique">
        <p className="text-gray-700">Conteneur de base utilisé pour les modales du footer. Contenu libre, scrollable.</p>
      </Modal>
      <ReportModal isOpen={reportOpen} onClose={() => setReportOpen(false)} />
      <AboutModal isOpen={aboutOpen} onClose={() => setAboutOpen(false)} />
      <ContactModal isOpen={contactOpen} onClose={() => setContactOpen(false)} />
      <MentionsModal isOpen={mentionsOpen} onClose={() => setMentionsOpen(false)} />

      {/* ====== ShareCard preview ====== */}
      <Section title="ShareCard - aperçu" subtitle="image générée pour le bouton Partager en fin de partie">
        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-start">
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-xl border border-white/[0.08] bg-[#0a0c12] p-3 shadow-2xl">
              {shareUrl ? (
                <img
                  src={shareUrl}
                  alt="Aperçu carte de partage"
                  className="block w-[270px] h-[480px] object-contain rounded-md"
                  style={{ imageRendering: 'auto' }}
                />
              ) : (
                <div className="w-[270px] h-[480px] flex items-center justify-center text-white/40 font-mono text-xs">
                  {shareLoading ? 'Génération…' : 'Aucun aperçu'}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button text="Partager" variant="primary" size="sm" onClick={handleSharePreview} />
              <Button text="Télécharger" variant="secondary" size="sm" onClick={handleDownloadPreview} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-white/35">Presets de score</span>
            <div className="grid grid-cols-1 gap-2">
              {SHARE_PRESETS.map((p, i) => {
                const active = i === shareIdx;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setShareIdx(i)}
                    className={`text-left px-3 py-2 rounded-lg border transition-colors font-mono text-xs flex items-center gap-3 ${active
                        ? 'border-amber-300/60 bg-amber-300/10 text-amber-100'
                        : 'border-white/[0.08] bg-[#1a1d28] text-white/70 hover:bg-[#23273a]'
                      }`}
                  >
                    <span
                      className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="flex-1">{p.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="font-mono text-[10px] text-white/30 mt-2 leading-relaxed">
              Format 1080×1920 (story 9:16) · fond bleu site + pattern points d'interrogation + panneau liquid glass + top 3 en cartes blanches style site.
            </p>
          </div>
        </div>
      </Section>

      {/* ====== Inputs ====== */}
      <Section title="Inputs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Tile label="PseudoPlate">
            <div className="w-full max-w-xs">
              <PseudoPlate value={pseudoValue} onChange={(e) => setPseudoValue(e.target.value)} />
            </div>
          </Tile>
          <Tile label="Réponse (textarea)">
            <div className="w-full max-w-xs h-32 rounded-2xl border-[2.5px] border-black stack-shadow bg-cream-player texture-paper overflow-hidden">
              <textarea
                value={answerValue}
                onChange={(e) => setAnswerValue(e.target.value)}
                placeholder="Écris ta réponse…"
                className="w-full h-full bg-transparent resize-none outline-none text-gray-900 text-base leading-relaxed px-4 py-3 placeholder:text-gray-400"
              />
            </div>
          </Tile>
        </div>
      </Section>
    </div>
  );
};

export default StudioGallery;
