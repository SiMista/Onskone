import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { useEffect, useRef, useState } from 'react';

/**
 * Régression : le filet qui envoie le brouillon au démontage d'AnswerPhase avait
 * été écrit SANS tableau de dépendances. React rejoue alors le cleanup à chaque
 * render — donc à chaque frappe — ce qui provoquait un `submitAnswer` par lettre
 * (rate limit serveur, et réponse visible chez le pilier pendant la saisie).
 *
 * Ce test reproduit la mécanique exacte du composant (ref de brouillon + cleanup
 * de démontage) et vérifie qu'un render ne déclenche JAMAIS d'envoi.
 */
const Harness = ({ emit }: { emit: (draft: string) => void }) => {
  const [answer, setAnswer] = useState('');
  const answerRef = useRef(answer);
  answerRef.current = answer;
  const submittedRef = useRef(false);

  const flushRef = useRef<() => void>(() => { });
  flushRef.current = () => {
    if (submittedRef.current) return;
    const draft = answerRef.current.trim();
    if (!draft) return;
    submittedRef.current = true;
    emit(draft);
  };

  useEffect(() => () => { flushRef.current(); }, []);

  return (
    <input
      value={answer}
      onChange={(e) => setAnswer(e.target.value)}
      aria-label="reponse"
    />
  );
};

describe('AnswerPhase — envoi du brouillon au démontage', () => {
  // Chaque cas monte son propre harness : sans nettoyage, les <input> des cas
  // précédents restent dans le DOM et les requêtes deviennent ambiguës.
  afterEach(cleanup);

  it("n'envoie RIEN pendant la frappe", () => {
    const emit = vi.fn();
    const { getByLabelText } = render(<Harness emit={emit} />);
    const input = getByLabelText('reponse') as HTMLInputElement;

    for (const value of ['b', 'bo', 'bon', 'bonj']) {
      fireEvent.change(input, { target: { value } });
    }

    expect(emit).not.toHaveBeenCalled();
  });

  it('envoie le brouillon une seule fois, au démontage', () => {
    const emit = vi.fn();
    const { getByLabelText, unmount } = render(<Harness emit={emit} />);
    const input = getByLabelText('reponse') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'ma reponse' } });
    unmount();

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('ma reponse');
  });

  it("n'envoie rien si le champ est vide au démontage", () => {
    const emit = vi.fn();
    const { unmount } = render(<Harness emit={emit} />);
    unmount();
    expect(emit).not.toHaveBeenCalled();
  });
});
