import { useUserProfile } from '@/ui/hooks/useUserProfile';
import { InitialsAvatar } from '@/ui/components/InitialsAvatar';

type UserAvatarProps = {
  size?: 'sm' | 'md' | 'lg';
};

export function UserAvatar({ size = 'md' }: UserAvatarProps) {
  const profile = useUserProfile();
  const name = profile?.displayName ?? profile?.email ?? 'Usuário';

  return <InitialsAvatar name={name} size={size} />;
}
