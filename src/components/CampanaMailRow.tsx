"use client";

import { PauseCircle, PlayCircle, StopCircle, Trash2 } from "lucide-react";
import { useCampanaMail } from "@/lib/useCampanaMail";
import { fmtFecha } from "@/lib/fechas";
import { panelCardClass } from "@/components/formStyles";

function fmtFechaHora(iso: string): string {
  const hora = new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  return `${fmtFecha(iso)} ${hora}`;
}

// Misma tarjeta que una tanda cualquiera en EnviosActivosPanel.tsx (mismas
// clases, mismo layout) -- la campaña automática no es una tanda (no tiene
// items fijos, corre día a día hasta agotar el filtro contra la base), pero
// tiene que verse como un envío activo más, no como un cartel aparte.
export default function CampanaMailRow() {
  const { campana, cupoHoy, cargando, recargar } = useCampanaMail();

  async function pausar() {
    if (!campana) return;
    await fetch("/api/admin/mail/campana", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: campana.id, accion: "pausar" }),
    });
    recargar();
  }

  async function reanudar() {
    if (!campana) return;
    await fetch("/api/admin/mail/campana", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: campana.id, accion: "reanudar" }),
    });
    recargar();
  }

  async function frenar() {
    if (!campana) return;
    if (!window.confirm("¿Frenar la campaña automática? Lo que ya se mandó queda mandado, pero no va a seguir sola. No se puede reanudar después.")) return;
    await fetch(`/api/admin/mail/campana?id=${campana.id}`, { method: "DELETE" });
    recargar();
  }

  async function eliminar() {
    if (!campana) return;
    if (!window.confirm("¿Eliminar esta campaña? No se puede deshacer.")) return;
    await fetch(`/api/admin/mail/campana?id=${campana.id}&modo=eliminar`, { method: "DELETE" });
    recargar();
  }

  if (cargando || !campana) return null;

  const pausada = campana.estado === "pausada";
  const pct = cupoHoy && cupoHoy.tope > 0 ? Math.round((cupoHoy.yaEnviadosHoy / cupoHoy.tope) * 100) : 0;

  return (
    <div className={panelCardClass}>
      <div className="w-full text-left p-3 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-sm font-medium text-[var(--color-brand-dark)]">Mail</span>
            <span className="text-xs text-[var(--color-text-muted)] truncate">{campana.asunto} — campaña automática</span>
            <span className="text-xs text-[var(--color-text-muted)]">{fmtFechaHora(campana.creado_en)}</span>
          </div>
          <div className="h-1.5 w-full max-w-[220px] bg-[var(--color-bg-warm)] rounded-full overflow-hidden">
            <div className="h-full bg-[var(--color-brand-red)] transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-xs px-2 py-1 rounded ${pausada ? "bg-gray-100 text-gray-700" : "bg-amber-100 text-amber-800"}`}>
            {pausada ? "Pausada" : cupoHoy ? `${cupoHoy.yaEnviadosHoy}/${cupoHoy.tope} hoy` : "En curso"}
          </span>
          {pausada ? (
            <button
              type="button"
              onClick={reanudar}
              className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-brand-red)] hover:bg-[var(--color-surface-subtle)]"
              aria-label="Reanudar campaña"
              title="Reanudar campaña"
            >
              <PlayCircle className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={pausar}
              className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-brand-red)] hover:bg-[var(--color-surface-subtle)]"
              aria-label="Pausar campaña"
              title="Pausar campaña"
            >
              <PauseCircle className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={frenar}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-red-600 hover:bg-red-50"
            aria-label="Frenar campaña"
            title="Frenar campaña (no se puede reanudar después)"
          >
            <StopCircle className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={eliminar}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-red-600 hover:bg-red-50"
            aria-label="Eliminar campaña"
            title="Eliminar campaña"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
