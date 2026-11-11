import { RoundPhase } from '@onskone/shared';
import type { GameCard } from '@onskone/shared';
import type { Dictionary } from '../i18n/dictionary';

/** Astuce de la question (colonne « Le Tip ! » de l'Excel) : indexée par son texte exact sur la carte. */
export function getQuestionTip(card: GameCard | undefined, question: string): string | undefined {
  const tip = card?.tips?.[question];
  return typeof tip === 'string' && tip.trim() ? tip : undefined;
}

/**
 * Sous-titre affiché sous la QuestionCard selon la phase et le rôle.
 * Reçoit `t.phases` pour rester traduit, on évite ainsi un hook côté util.
 */
export function getQuestionSubtitle(
  phases: Dictionary['phases'],
  phase: RoundPhase,
  isLeader: boolean
): string {
  if (phase === RoundPhase.ANSWERING) {
    return isLeader ? phases.answering.questionAskedToOthers : phases.answering.questionAskedBy;
  }
  if (phase === RoundPhase.SUBSTITUTE_SELECTION) {
    return isLeader ? phases.substituteSelection.chooseGuesser : phases.answering.questionAskedBy;
  }
  if (phase === RoundPhase.SUBSTITUTE_ANSWERING) {
    return phases.answering.questionAskedBy;
  }
  return '';
}
