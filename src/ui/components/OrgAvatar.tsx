import type { Organization } from '@/domain/identity';
import { useEffect, useState } from 'react';
import { useIdentity } from '@/ui/app/AppServicesContext';
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
  const identity = useIdentity();
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const rounded = variant === 'square' ? 'rounded-lg' : 'rounded-full';

  useEffect(() => {
    let active = true;

    if (!organization.imageStorageKey) {
      setImageUrl(null);
      return;
    }

    identity
      .getSignedUrl(organization.imageStorageKey)
      .then((url) => {
        if (active) {
          setImageUrl(url);
        }
      })
      .catch(() => {
        if (active) {
          setImageUrl(null);
        }
      });

    return () => {
      active = false;
    };
  }, [identity, organization.imageStorageKey]);

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
