import Avatar from './Avatar';
import { IPlayer } from '@onskone/shared';
import { useLocale } from '../i18n';
import PremiumName from './PremiumName';

const QuestionByline = ({
  player,
}: {
  player: Pick<IPlayer, 'avatarId' | 'name' | 'isPremium'> | undefined | null;
}) => {
  const { t } = useLocale();
  if (!player) return null;
  const displayText = t.phases.questionByline.askedThisQuestion;
  return (
    <div className="flex items-center justify-center flex-wrap gap-x-2 gap-y-1 text-sm md:text-base leading-none">
      <Avatar avatarId={player.avatarId} name={player.name} size="sm" />
      <PremiumName name={player.name} premium={!!player.isPremium} className="font-semibold text-gray-900" />
      <span className="italic text-gray-700">{displayText}</span>
    </div>
  );
};

export default QuestionByline;
