import type { GroupKind } from '@/domain/ensemble';
import {
  IconGraduationCap,
  IconLayers,
  IconMic,
  IconMusic,
} from '@/ui/components/icons';

type GroupKindIconProps = {
  kind: GroupKind;
  className?: string;
};

export function GroupKindIcon({ kind, className = 'h-5 w-5 shrink-0' }: GroupKindIconProps) {
  switch (kind) {
    case 'ensemble':
      return <IconMusic className={className} />;
    case 'choir':
      return <IconMic className={className} />;
    case 'class':
      return <IconGraduationCap className={className} />;
    case 'other':
      return <IconLayers className={className} />;
  }
}
