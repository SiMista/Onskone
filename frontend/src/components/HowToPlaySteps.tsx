import { Icon } from '@iconify/react';

const HOW_TO_PLAY_STEPS = [
  {
    n: '1',
    icon: 'fluent-emoji-flat:crown',
    text: (<>Un <b>pilier</b> est designé aléatoirement et choisit une question parmi trois cartes.</>),
    rot: '-1deg',
  },
  {
    n: '2',
    icon: 'fluent-emoji-flat:memo',
    text: (<>Tout le monde répond <b>anonymement</b> et le pilier devine qui a écrit quelle réponse.</>),
    rot: '0.8deg',
  },
  {
    n: '3',
    icon: 'fluent-emoji-flat:party-popper',
    text: (<>On révèle les prénoms, le pilier marque des points pour l'équipe et on passe au suivant.</>),
    rot: '-0.6deg',
  },
] as const;

const HowToPlaySteps = ({ size = 'md' }: { size?: 'md' | 'lg' }) => {
  const isLg = size === 'lg';
  return (
    <div className="w-full">
      <div className="space-y-3 w-full">
        {HOW_TO_PLAY_STEPS.map(({ n, icon, text, rot }, i) => (
          <div
            key={n}
            className="animate-step-drop"
            style={{ animationDelay: `${300 + i * 520}ms` }}
          >
            <div
              className="flex items-center gap-3 bg-cream-player border-[2.5px] border-black rounded-xl p-3 stack-shadow-sm texture-paper hover:-translate-y-0.5 transition-transform"
              style={{ transform: `rotate(${rot})` }}
            >
              <div className={`flex-shrink-0 ${isLg ? 'w-11 h-11 text-lg' : 'w-10 h-10 text-base'} rounded-full flex items-center justify-center text-gray-800 bg-[#f3ece2] border-[2.5px] border-black font-display`}>
                {n}
              </div>
              <Icon icon={icon} className="flex-shrink-0" width={isLg ? 30 : 26} height={isLg ? 30 : 26} aria-hidden />
              <p className={`${isLg ? 'text-base' : 'text-sm'} m-0 leading-snug`}>{text}</p>
            </div>
          </div>
        ))}
      </div>
      <p
        className={`text-center ${isLg ? 'text-xl mt-4' : 'text-lg pt-3'} font-display text-primary animate-step-drop`}
        style={{ animationDelay: `${300 + HOW_TO_PLAY_STEPS.length * 520}ms` }}
      >
        Alors, on se connaît ?
      </p>
    </div>
  );
};

export default HowToPlaySteps;
