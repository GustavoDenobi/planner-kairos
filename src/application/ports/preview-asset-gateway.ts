export type PreviewAssetPurpose = 'invite' | 'claim';

export type PreviewAssetGateway = {
  signBranding(
    purpose: PreviewAssetPurpose,
    token: string,
    storageKey: string,
  ): Promise<string | null>;
};
