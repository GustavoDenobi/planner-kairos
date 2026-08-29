import type { Organization } from '@/domain/identity';
import { useOrgImageUrl } from '@/ui/hooks/useOrgImageUrl';
import { getInitials } from '@/ui/utils/initials';

type OrgAvatarProps = {
  organization: Organization;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'circle' | 'square';
};

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
};

export function OrgAvatar({ organization, size = 'md', variant = 'circle' }: OrgAvatarProps) {
  const imageUrl = useOrgImageUrl(organization.imageStorageKey);

  const rounded = variant === 'square' ? 'rounded-lg' : 'rounded-full';

  const fallbackClass = `flex shrink-0 items-center justify-center bg-primary/15 font-semibold text-primary ${rounded} ${sizeClasses[size]}`;

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={organization.name}
        className={`${sizeClasses[size]} shrink-0 object-cover ${rounded}`}
      />
    );
  }

  return <div className={fallbackClass}>{getInitials(organization.name)}</div>;
}
