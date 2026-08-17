import { getInitials } from '@/ui/utils/initials';

type InitialsAvatarProps = {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
};

export function InitialsAvatar({ name, size = 'md', className = '' }: InitialsAvatarProps) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary ${sizeClasses[size]} ${className}`}
    >
      {getInitials(name)}
    </div>
  );
}
