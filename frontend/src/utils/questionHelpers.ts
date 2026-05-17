import { RoundPhase } from '@onskone/shared';

/**
 * Sous-titre affiché sous la QuestionCard selon la phase et le rôle.
 * Centralise le wording pour ne pas avoir à le retoucher dans 4 fichiers.
 */
export function getQuestionSubtitle(
  phase: RoundPhase,
  isLeader: boolean
): string {
  if (phase === RoundPhase.ANSWERING) {
    return isLeader ? 'Question posée aux autres joueurs' : 'Question posée par';
  }
  if (phase === RoundPhase.SUBSTITUTE_SELECTION) {
    return isLeader ? 'Choisis qui devra deviner ta réponse' : 'Question posée par';
  }
  if (phase === RoundPhase.SUBSTITUTE_ANSWERING) {
    return 'Question posée par';
  }
  return '';
}
