/** Estado de navegação para /orgs: entra direto quando o usuário tem uma única organização. */
export const AUTO_ENTER_SINGLE_ORG_STATE = { autoEnterSingleOrg: true } as const;

export function readAutoEnterSingleOrg(state: unknown): boolean {
  return (
    typeof state === 'object' &&
    state !== null &&
    (state as { autoEnterSingleOrg?: unknown }).autoEnterSingleOrg === true
  );
}
