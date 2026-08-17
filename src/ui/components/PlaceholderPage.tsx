type PlaceholderPageProps = {
  title: string;
  description?: string;
};

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold text-text">{title}</h1>
      <p className="text-muted">
        {description ?? 'Esta funcionalidade será implementada em breve.'}
      </p>
    </div>
  );
}
