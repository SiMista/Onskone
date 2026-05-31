import Avatar from './Avatar';
import { IPlayer } from '@onskone/shared';
import { useLocale } from '../i18n';

interface QuestionBylineProps {
  player: Pick<IPlayer, 'avatarId' | 'name'> | undefined | null;
  text?: string;
}

const QuestionByline: React.FC<QuestionBylineProps> = ({
  player,
  text,
}) => {
  const { t } = useLocale();
  if (!player) return null;
  const displayText = text ?? t.phases.questionByline.askedThisQuestion;
  return (
    <div className="flex items-center justify-center flex-wrap gap-x-2 gap-y-1 text-sm md:text-base leading-none">
      <Avatar avatarId={player.avatarId} name={player.name} size="sm" />
      <span className="font-semibold text-gray-900">{player.name}</span>
      <span className="italic text-gray-700">{displayText}</span>
    </div>
  );
};

export default QuestionByline;
