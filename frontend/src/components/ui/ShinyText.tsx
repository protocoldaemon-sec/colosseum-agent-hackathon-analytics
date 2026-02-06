import { CSSProperties, FC, ReactNode } from 'react';

interface ShinyTextProps {
  children: ReactNode;
  className?: string;
  shimmerWidth?: number;
}

const ShinyText: FC<ShinyTextProps> = ({
  children,
  className = '',
  shimmerWidth = 100,
}) => {
  return (
    <p
      style={
        {
          '--shimmer-width': `${shimmerWidth}px`,
        } as CSSProperties
      }
      className={`shiny-text ${className}`}
    >
      {children}
    </p>
  );
};

export default ShinyText;
