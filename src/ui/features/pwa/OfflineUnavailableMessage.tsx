export function OfflineUnavailableMessage() {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 text-center">
      <h2 className="text-lg font-semibold text-text">Indisponível offline</h2>
      <p className="mt-2 text-sm text-muted">
        Esta página exige conexão com a internet. Abra a Agenda ou Playlists para acessar conteúdo
        salvo no dispositivo.
      </p>
    </div>
  );
}
