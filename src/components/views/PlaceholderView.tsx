interface Props {
  titulo: string;
  descripcion: string;
}

export default function PlaceholderView({ titulo, descripcion }: Props) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--color-brand-dark)]">{titulo}</h1>
        <p className="text-sm text-[var(--color-text-muted)]">{descripcion}</p>
      </div>
      <div className="text-center py-16 border border-dashed border-[var(--color-border)] rounded-2xl">
        <p className="text-sm text-[var(--color-text-muted)]">Sección lista para conectar cuando definas la fuente de datos.</p>
      </div>
    </div>
  );
}
