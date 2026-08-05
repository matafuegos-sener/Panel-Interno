"use client";

import { useEffect, useState } from "react";
import { TablaOrigen } from "@/data/crm";
import { MensajePredefinido } from "@/data/mensajes";
import { reemplazarVariables } from "@/lib/plantillas";
import { panelCardClass, btnPrimaryClass } from "@/components/formStyles";

interface FilaTanda {
  id: string;
  tabla: TablaOrigen;
  nombre: string;
  telefono: string | null;
  whatsapp_enviado: boolean;
  whatsapp_sin_wa: boolean;
}

function waLink(telefono: string, mensaje: string): string {
  const digits = telefono.replace(/[^\d]/g, "");
  return `https://web.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(mensaje)}`;
}

interface Props {
  plantillaId: string;
  itemsParam: string;
}

export default function WhatsappTandaView({ plantillaId, itemsParam }: Props) {
  const [plantilla, setPlantilla] = useState<MensajePredefinido | null>(null);
  const [filas, setFilas] = useState<FilaTanda[] | null>(null);
  const [error, setError] = useState("");

  const items = itemsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [tabla, id] = s.split(":");
      return { tabla: tabla as TablaOrigen, id };
    });
  const tandaInvalida = !plantillaId || items.length === 0;

  useEffect(() => {
    if (tandaInvalida) return;

    Promise.all([
      fetch(`/api/admin/mensajes/${plantillaId}`).then((r) => r.json()),
      fetch("/api/admin/crm/tanda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      }).then((r) => r.json()),
    ]).then(([mensaje, tanda]) => {
      if (mensaje?.error) {
        setError(mensaje.error);
        return;
      }
      setPlantilla(mensaje);
      setFilas(Array.isArray(tanda) ? tanda : []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantillaId, itemsParam]);

  async function marcar(fila: FilaTanda, campo: "whatsapp_enviado" | "whatsapp_sin_wa", valor: boolean) {
    const res = await fetch(`/api/admin/crm/contactos/${fila.id}/estado`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tabla: fila.tabla, [campo]: valor }),
    });
    if (!res.ok) {
      window.alert("No se pudo guardar.");
      return;
    }
    setFilas((prev) => prev && prev.map((f) => (f.tabla === fila.tabla && f.id === fila.id ? { ...f, [campo]: valor } : f)));
  }

  async function copiarYAbrir(fila: FilaTanda) {
    if (!fila.telefono || !plantilla) return;
    const mensaje = reemplazarVariables(plantilla.cuerpo, fila.nombre);
    window.open(waLink(fila.telefono, mensaje), "_blank");
    try {
      await navigator.clipboard.writeText(mensaje);
    } catch {
      window.alert("Se abrió WhatsApp, pero no se pudo copiar el mensaje automáticamente — pegalo a mano.");
    }
  }

  if (tandaInvalida) {
    return (
      <p className={`${panelCardClass} p-6 text-sm text-[var(--color-text-muted)]`}>
        Tanda inválida o vacía — volvé al panel de WhatsApp y armá una tanda de nuevo.
      </p>
    );
  }

  if (error) {
    return <p className={`${panelCardClass} p-6 text-sm text-[var(--color-text-muted)]`}>{error}</p>;
  }

  if (!plantilla || filas === null) {
    return <p className="text-sm text-[var(--color-text-muted)]">Cargando tanda…</p>;
  }

  const total = filas.length;
  const enviados = filas.filter((f) => f.whatsapp_enviado).length;
  const sinWa = filas.filter((f) => f.whatsapp_sin_wa).length;
  const pendientes = total - enviados - sinWa;

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-[var(--color-brand-dark)]">Tanda WhatsApp — {plantilla.titulo}</h1>
        <p className="text-sm text-[var(--color-text-muted)]">{total} contacto{total === 1 ? "" : "s"} en esta tanda</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <span className="text-xs px-2 py-1 rounded border border-[var(--color-border)]">{total} en la tanda</span>
        <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-800">{enviados} enviados</span>
        <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-800">{sinWa} sin WhatsApp</span>
        <span className="text-xs px-2 py-1 rounded border border-[var(--color-border)]">{pendientes} pendiente{pendientes === 1 ? "" : "s"}</span>
      </div>

      <div className="flex flex-col gap-3">
        {filas.map((f) => (
          <div key={`${f.tabla}-${f.id}`} className={`${panelCardClass} p-4 ${f.whatsapp_enviado ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                <p className="font-medium text-[var(--color-brand-dark)]">{f.nombre}</p>
                <p className="text-sm text-[var(--color-text-muted)]">{f.telefono || "sin teléfono"}</p>
              </div>
              <div className="flex flex-col gap-1 text-sm shrink-0">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={f.whatsapp_enviado} onChange={(e) => marcar(f, "whatsapp_enviado", e.target.checked)} className="accent-[var(--color-brand-red)]" />
                  Enviado
                </label>
                <label className="flex items-center gap-1.5 text-amber-700">
                  <input type="checkbox" checked={f.whatsapp_sin_wa} onChange={(e) => marcar(f, "whatsapp_sin_wa", e.target.checked)} className="accent-amber-600" />
                  Sin WhatsApp
                </label>
              </div>
            </div>
            <p className="text-sm whitespace-pre-line text-[var(--color-text-muted)] mb-3">{reemplazarVariables(plantilla.cuerpo, f.nombre)}</p>
            <button type="button" onClick={() => copiarYAbrir(f)} disabled={!f.telefono} className={btnPrimaryClass}>
              Copiar mensaje y abrir WhatsApp
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
