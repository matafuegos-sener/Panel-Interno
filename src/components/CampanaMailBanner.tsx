"use client";

import { useCampanaMail } from "@/lib/useCampanaMail";
import { fmtFecha } from "@/lib/fechas";
import { btnSecondaryClass, panelCardClass } from "@/components/formStyles";

function fmtFechaHora(iso: string): string {
  const hora = new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  return `${fmtFecha(iso)} ${hora}`;
}

// Se muestra arriba de "Envíos activos — Mails" (EnviosActivosView) para que
// se vea acá también, sin tener que entrar a Envío de mails -- la campaña
// manda sola, todos los días, y usa el mismo cupo diario que el envío manual
// (mailTope.ts): si el cupo ya está gastado y no se ve por qué, esto lo explica.
export default function CampanaMailBanner() {
  const { campana, cargando, recargar } = useCampanaMail();

  async function cancelar() {
    if (!campana) return;
    if (!window.confirm("¿Cancelar la campaña automática? Lo que ya se mandó queda mandado, pero no va a seguir sola.")) return;
    await fetch(`/api/admin/mail/campana?id=${campana.id}`, { method: "DELETE" });
    recargar();
  }

  if (cargando || !campana) return null;

  return (
    <div className={`${panelCardClass} p-4 mb-4 flex flex-wrap items-center justify-between gap-3 border-amber-300`}>
      <p className="text-sm text-[var(--color-text-muted)]">
        <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-2" />
        <strong className="text-[var(--color-brand-dark)]">Campaña automática activa</strong> — manda sola todos los días (~10:00 AM),
        usa el mismo cupo diario que el envío manual. <strong className="text-[var(--color-brand-dark)]">{campana.total_enviados}</strong> enviado
        {campana.total_enviados === 1 ? "" : "s"} hasta ahora
        {campana.ultima_corrida_en && <> — última corrida {fmtFechaHora(campana.ultima_corrida_en)}</>}.
      </p>
      <button type="button" onClick={cancelar} className={btnSecondaryClass}>
        Cancelar campaña
      </button>
    </div>
  );
}
