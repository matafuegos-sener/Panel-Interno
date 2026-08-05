"use client";

import EnviosActivosPanel from "@/components/EnviosActivosPanel";

export default function EnviosActivosView() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--color-brand-dark)]">Envíos activos</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Tandas de mail y WhatsApp en curso o recién terminadas</p>
      </div>
      <EnviosActivosPanel />
    </div>
  );
}
