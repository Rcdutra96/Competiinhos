import { useState } from 'react';
import { getInitials } from '../lib/utils';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-xl',
};

export function Avatar({
  src,
  name,
  size = 'md',
  className = '',
}: AvatarProps) {
  const [imgError, setImgError] = useState(false);

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setImgError(true)}
        className={`${SIZE_CLASSES[size]} shrink-0 rounded-full border border-zinc-700/70 bg-zinc-800 object-cover ${className}`}
      />
    );
  }

  return (
    <div
      aria-label={name}
      className={`${SIZE_CLASSES[size]} flex shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/15 font-semibold text-emerald-300 ${className}`}
    >
      {getInitials(name)}
    </div>
  );
}
