"use client";

import { useState } from "react";
import { PauseCircle, PlayCircle, Trash2 } from "lucide-react";
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
  const { campana, cupoHoy, progreso, cargando, recargar, actualizarEstado } = useCampanaMail();
  // Bloquea los botones mientras hay un pedido en curso -- antes, si tardaba,
  // un segundo click mandaba un segundo pedido antes de que el primero
  // volviera, y no había forma de saber si ya había funcionado.
  const [enProceso, setEnProceso] = useState(false);

  async function cambiarEstado(accion: "pausar" | "reanudar") {
    if (!campana || enProceso) return;
    setEnProceso(true);
    const res = await fetch("/api/admin/mail/campana", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: campana.id, accion }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.campana) {
      // Actualiza directo con la fila que devuelve el PATCH -- pausar/reanudar
      // no cambian cuántos elegibles quedan, así que no hace falta volver a
      // pedir /api/admin/mail/campana (ese GET recorre toda la base filtrada
      // para calcular el progreso, lento y sin sentido acá).
      actualizarEstado(data.campana.estado);
    } else {
      window.alert(`No se pudo completar la acción: ${data.error ?? res.statusText}`);
    }
    setEnProceso(false);
  }

  async function eliminar() {
    if (!campana || enProceso) return;
    if (!window.confirm("¿Eliminar esta campaña? No se puede deshacer.")) return;
    setEnProceso(true);
    const res = await fetch(`/api/admin/mail/campana?id=${campana.id}&modo=eliminar`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(`No se pudo eliminar: ${data.error ?? res.statusText}`);
      setEnProceso(false);
      return;
    }
    recargar();
  }

  // Antes escondía toda la fila mientras `cargando` (cada recargar() la
  // ponía en true, incluida la que dispara pausar/reanudar) -- la fila
  // desaparecía y volvía a aparecer con cada click, aunque el pedido hubiera
  // funcionado. Ahora solo se esconde si todavía no hay datos (carga inicial).
  if (!campana && cargando) return null;
  if (!campana) return null;

  const pausada = campana.estado === "pausada";
  const meta = progreso ? campana.total_enviados + progreso.elegiblesRestantes : null;
  // Progreso real = enviados hasta ahora sobre el total de la base que
  // cumple el filtro hoy (elegibles restantes + ya enviados) -- no el cupo
  // de hoy. El cupo lleno (ej. 50/50) no significa campaña terminada, solo
  // que hoy ya no manda más; por eso va aparte, como texto, no como barra.
  const pct = meta && meta > 0 ? Math.round((campana.total_enviados / meta) * 100) : 0;
  const cupoLleno = !!cupoHoy && cupoHoy.restante <= 0;

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
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            {progreso ? (
              <>
                <strong className="text-[var(--color-brand-dark)]">{campana.total_enviados}</strong> enviados de{" "}
                <strong className="text-[var(--color-brand-dark)]">{meta}</strong> en la base filtrada — faltan{" "}
                <strong className="text-[var(--color-brand-dark)]">{progreso.elegiblesRestantes}</strong>
                {progreso.diasRestantes > 0 && <> (~{progreso.diasRestantes} día{progreso.diasRestantes === 1 ? "" : "s"} más al ritmo actual)</>}
              </>
            ) : (
              "Calculando cuántos faltan…"
            )}
            {cupoHoy && (
              <>
                {" "}
                — cupo de hoy: {cupoHoy.yaEnviadosHoy}/{cupoHoy.tope}
                {cupoLleno && " (ya se usó todo, retoma mañana)"}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-xs px-2 py-1 rounded ${pausada ? "bg-gray-100 text-gray-700" : "bg-amber-100 text-amber-800"}`}>
            {pausada ? "Pausada" : "En curso"}
          </span>
          {pausada ? (
            <button
              type="button"
              onClick={() => cambiarEstado("reanudar")}
              disabled={enProceso}
              className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-brand-red)] hover:bg-[var(--color-surface-subtle)] disabled:opacity-40"
              aria-label="Reanudar campaña"
              title="Reanudar campaña"
            >
              <PlayCircle className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => cambiarEstado("pausar")}
              disabled={enProceso}
              className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-brand-red)] hover:bg-[var(--color-surface-subtle)] disabled:opacity-40"
              aria-label="Pausar campaña"
              title="Pausar campaña"
            >
              <PauseCircle className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={eliminar}
            disabled={enProceso}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-red-600 hover:bg-red-50 disabled:opacity-40"
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
