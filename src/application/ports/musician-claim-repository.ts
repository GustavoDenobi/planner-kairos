import type { MusicianClaimPreview } from '@/domain/identity';

export type MusicianClaimContact = {
  displayName: string;
  phone?: string;
  birthDate?: string;
};

export type MusicianClaimRepository = {
  previewByMusicianId(musicianId: string): Promise<MusicianClaimPreview | null>;
  claim(musicianId: string, contact: MusicianClaimContact): Promise<string>;
};
