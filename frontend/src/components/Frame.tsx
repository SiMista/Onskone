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
      className={`bg-white py-5 px-10 box-border rounded-lg border-2 border-black stack-shadow m-0 flex flex-col items-center gap-3 texture-paper ${textAlignClass}`}
      style={{ width }}
    >
      {children}
    </div>
  );
};

export default Frame;
