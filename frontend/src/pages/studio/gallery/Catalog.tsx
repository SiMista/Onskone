import { useState } from 'react';
import { Icon } from '@iconify/react';
import Button from '../../../components/Button';
import BackButton from '../../../components/BackButton';
import PseudoPlate from '../../../components/PseudoPlate';
import Dropdown from '../../../components/Dropdown';
import Avatar from '../../../components/Avatar';
import { Section, Tile } from './layout';

type ButtonVariant = 'primary' | 'success' | 'danger' | 'warning' | 'secondary' | 'ghost' | 'quit';

const BUTTON_VARIANTS: ButtonVariant[] = ['primary', 'success', 'danger', 'warning', 'secondary', 'ghost', 'quit'];

// Échantillons pour la galerie du Dropdown
const DROPDOWN_PLAYERS = [
  { id: 'p1', name: 'Léa', avatarId: 9 },
  { id: 'p2', name: 'Thomas', avatarId: 16 },
  { id: 'p3', name: 'Mathilde', avatarId: 22 },
  { id: 'p4', name: 'Nico', avatarId: 5 },
];

const DROPDOWN_CATEGORIES = [
  {
    value: 'question_report',
    label: 'Question pourrie',
    description: 'Une question gênante, ambiguë ou mal formulée.',
    icon: 'fluent-emoji-flat:warning',
  },
  {
    value: 'bug',
    label: 'Bug technique',
    description: 'Un truc qui marche pas comme attendu.',
    icon: 'fluent-emoji-flat:bug',
  },
  {
    value: 'suggestion',
    label: 'Idée / suggestion',
    description: 'Une proposition de fonctionnalité ou de contenu.',
    icon: 'fluent-emoji-flat:light-bulb',
  },
];

// Catalogue statique : composants d'interface affichés tels quels (boutons, inputs, dropdown).
export const Catalog = () => {
  const [pseudoValue, setPseudoValue] = useState('Simi');
  const [answerValue, setAnswerValue] = useState('');
  const [dropdownPlayerId, setDropdownPlayerId] = useState<string>(DROPDOWN_PLAYERS[0].id);
  const [dropdownCategory, setDropdownCategory] = useState<string>('');

  return (
    <>
      <Section title="Boutons - variantes" subtitle="size = md">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {BUTTON_VARIANTS.map((v) => (
            <Tile key={v} label={v}>
              <Button text={v} variant={v} />
            </Tile>
          ))}
        </div>
      </Section>

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

      <Section title="Dropdown" subtitle="composant générique - 4 cas d'usage">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Tile label="Joueurs (avatar + nom) - SubstituteSelection">
            <div className="w-full max-w-xs">
              <Dropdown
                value={dropdownPlayerId}
                onChange={setDropdownPlayerId}
                options={DROPDOWN_PLAYERS.map(p => ({
                  value: p.id,
                  label: p.name,
                  prefix: <Avatar avatarId={p.avatarId} name={p.name} size="sm" />,
                }))}
                placeholder="Aucun joueur disponible"
              />
            </div>
          </Tile>

          <Tile label="Catégories (titre + description) - ReportModal">
            <div className="w-full max-w-xs">
              <Dropdown
                value={dropdownCategory}
                onChange={setDropdownCategory}
                options={DROPDOWN_CATEGORIES.map(c => ({
                  value: c.value,
                  label: (
                    <span className="flex flex-col min-w-0 leading-tight">
                      <span>{c.label}</span>
                      <span className="font-normal text-gray-500 text-xs whitespace-normal mt-0.5">
                        {c.description}
                      </span>
                    </span>
                  ),
                  selectedLabel: c.label,
                  prefix: <Icon icon={c.icon} className="w-5 h-5" />,
                }))}
                placeholder="Sélectionne une catégorie…"
              />
            </div>
          </Tile>

          <Tile label="Désactivé">
            <div className="w-full max-w-xs">
              <Dropdown
                value={DROPDOWN_PLAYERS[1].id}
                onChange={() => {}}
                options={DROPDOWN_PLAYERS.map(p => ({
                  value: p.id,
                  label: p.name,
                  prefix: <Avatar avatarId={p.avatarId} name={p.name} size="sm" />,
                }))}
                disabled
              />
            </div>
          </Tile>

          <Tile label="Vide (aucune option)">
            <div className="w-full max-w-xs">
              <Dropdown
                value=""
                onChange={() => {}}
                options={[]}
                placeholder="Aucune option disponible"
              />
            </div>
          </Tile>
        </div>
      </Section>
    </>
  );
};
