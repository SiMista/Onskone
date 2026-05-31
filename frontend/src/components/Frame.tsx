// src/components/Frame.tsx
import { ReactNode } from 'react';

interface FrameProps {
  width?: string;   // ex: "300px" ou "80%"
  children: ReactNode;
  textAlign?: 'left' | 'center' | 'right';
}

const Frame = ({
  width = '100%',
  children,
  textAlign = "center"
}: FrameProps) => {
  const textAlignClass = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right'
  }[textAlign];

  return (
    <div
      className={`bg-white pt-4 pb-6 px-5 md:pt-5 md:pb-7 md:px-8 desktop-short:pt-3 desktop-short:pb-5 desktop-short:px-6 box-border rounded-lg border-2 border-black stack-shadow m-0 flex flex-col items-center gap-3 desktop-short:gap-2 texture-paper ${textAlignClass}`}
      style={{ width }}
    >
      {children}
    </div>
  );
};

export default Frame;
