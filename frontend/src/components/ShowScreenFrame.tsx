import { ReactNode } from 'react';
import stickmanShowPhone from '../assets/images/game/stickman-show-phone-cropped.png';

interface ShowScreenFrameProps {
  children: ReactNode;
  showHeading?: boolean;
}

const ShowScreenFrame: React.FC<ShowScreenFrameProps> = ({ children, showHeading = true }) => {
  return (
    <>
      {showHeading && (
        <p className="text-gray-900 text-base md:text-xl font-semibold text-center">
          Montre ton écran à tout le monde !
        </p>
      )}
      <div className="relative isolate w-full max-w-md pt-12 md:pt-16">
        <img
          src={stickmanShowPhone}
          alt=""
          aria-hidden
          draggable={false}
          className="absolute -top-5 md:-top-6 right-15 md:right-18 w-20 md:w-28 h-auto select-none pointer-events-none animate-float -z-10"
        />
        {children}
      </div>
    </>
  );
};

export default ShowScreenFrame;
