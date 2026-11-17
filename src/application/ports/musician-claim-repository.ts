import type { MusicianClaimPreview } from '@/domain/identity';

export type MusicianClaimContact = {
  displayName: string;
  phone?: string;
  birthDate?: string;
};

export type MusicianClaimRepository = {
  previewByToken(claimToken: string): Promise<MusicianClaimPreview | null>;
  claim(claimToken: string, contact: MusicianClaimContact): Promise<string>;
};
