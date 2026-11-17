import React from 'react';

interface DualSurfLogoProps {
  size?: number;
  className?: string;
  variant?: 'orange' | 'white' | 'dark' | 'dual';
}

/**
 * DualSurf Vector Logo
 * Features the signature Dual-Wave / Futuristic 'D' geometry
 * in Ubuntu Orange (#F45B19), White, or Dark (#111827).
 */
export const DualSurfLogo: React.FC<DualSurfLogoProps> = ({
  size = 24,
  className = '',
  variant = 'orange',
}) => {
  const getPrimaryFill = () => {
    if (variant === 'white') return '#FFFFFF';
    if (variant === 'dark') return '#111827';
    return 'url(#dsOrangeGrad)';
  };

  const getSecondaryFill = () => {
    if (variant === 'white') return '#FFFFFF';
    if (variant === 'dark') return '#111827';
    if (variant === 'dual') return '#FFFFFF';
    return '#F45B19';
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
      aria-label="DualSurf Logo"
    >
      <defs>
        <linearGradient id="dsOrangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF7533" />
          <stop offset="100%" stopColor="#F45B19" />
        </linearGradient>
      </defs>

      {/* Outer upper curve ribbon */}
      <path
        d="M10 8 C10 8, 55 8, 78 30 C95 48, 95 72, 75 90 C62 76, 55 58, 42 42 C30 28, 18 20, 10 20 Z"
        fill={getPrimaryFill()}
      />

      {/* Inner lower swoosh / crest */}
      <path
        d="M10 28 C18 28, 28 34, 38 46 C48 58, 54 74, 52 92 C38 92, 24 86, 16 76 C10 68, 10 50, 10 28 Z"
        fill={getSecondaryFill()}
      />
    </svg>
  );
};
