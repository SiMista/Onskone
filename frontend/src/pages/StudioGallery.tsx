import { useState } from 'react';
import Button from '../components/Button';
import BackButton from '../components/BackButton';
import PseudoPlate from '../components/PseudoPlate';
import InfoModal from '../components/InfoModal';
import HowToPlaySteps from '../components/HowToPlaySteps';
import HowToPlayButton from '../components/HowToPlayButton';
import { useToast } from '../components/Toast';

// =====================================================================
// StudioGallery — design-system preview for the Studio
// =====================================================================
// Rendered inside the Studio page when the "Composants" tab is active.
// Goal: see the key reusable visuals side-by-side to spot inconsistencies.
// =====================================================================

type ButtonVariant = 'primary' | 'success' | 'danger' | 'warning' | 'secondary' | 'ghost';

const BUTTON_VARIANTS: ButtonVariant[] = ['primary', 'success', 'danger', 'warning', 'secondary', 'ghost'];

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

const StudioGallery = () => {
  const showToast = useToast();
  const [pseudoValue, setPseudoValue] = useState('Simi');
  const [answerValue, setAnswerValue] = useState('');
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);

  return (
    <div className="p-6 max-w-[1400px] mx-auto flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl text-white tracking-tight">
          Galerie <span className="text-amber-300">/ composants</span>
        </h1>
        <p className="font-mono text-[11px] text-white/45">
          Aperçu live des éléments d'interface — utilise-le pour vérifier la cohérence visuelle avant un commit.
        </p>
      </div>

      {/* ====== Boutons : variantes ====== */}
      <Section title="Boutons — variantes" subtitle="size = md">
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
      <Section title="Modales" subtitle="popups d'information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Tile label="Comment jouer ?">
            <HowToPlayButton onClick={() => setHowToPlayOpen(true)} />
          </Tile>
        </div>
      </Section>

      <InfoModal
        isOpen={howToPlayOpen}
        onClose={() => setHowToPlayOpen(false)}
        title="Comment jouer ?"
      >
        <HowToPlaySteps />
      </InfoModal>

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
