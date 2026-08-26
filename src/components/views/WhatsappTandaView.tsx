"use client";

import { useEffect, useRef, useState } from "react";
import { TablaOrigen } from "@/data/crm";
import { MensajePredefinido } from "@/data/mensajes";
import { reemplazarVariables } from "@/lib/plantillas";
import { panelCardClass, btnPrimaryClass } from "@/components/formStyles";

const ESPERA_BEEP_MS = 10 * 60 * 1000;

function reproducirBeep() {
  const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioContextCtor();
  const tonos = [0, 250, 500];
  tonos.forEach((delayMs) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.value = 0.2;
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    const start = ctx.currentTime + delayMs / 1000;
    oscillator.start(start);
    oscillator.stop(start + 0.15);
  });
}

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
  tandaId: string;
}

export default function WhatsappTandaView({ tandaId }: Props) {
  const [plantilla, setPlantilla] = useState<MensajePredefinido | null>(null);
  const [filas, setFilas] = useState<FilaTanda[] | null>(null);
  const [error, setError] = useState("");
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  useEffect(() => {
    if (!tandaId) return;

    fetch(`/api/admin/whatsapp/tanda/${tandaId}`)
      .then((r) => r.json())
      .then(async (tanda) => {
        if (tanda?.error) {
          setError(tanda.error);
          return;
        }
        const [mensaje, filasEnriquecidas] = await Promise.all([
          fetch(`/api/admin/mensajes/${tanda.plantillaId}`).then((r) => r.json()),
          fetch("/api/admin/crm/tanda", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: tanda.items }),
          }).then((r) => r.json()),
        ]);
        if (mensaje?.error) {
          setError(mensaje.error);
          return;
        }
        setPlantilla(mensaje);
        setFilas(Array.isArray(filasEnriquecidas) ? filasEnriquecidas : []);
      });
  }, [tandaId]);

  async function marcar(fila: FilaTanda, campo: "whatsapp_enviado" | "whatsapp_sin_wa", valor: boolean) {
    const res = await fetch(`/api/admin/crm/contactos/${fila.id}/estado`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tabla: fila.tabla, tandaId, [campo]: valor }),
    });
    if (!res.ok) {
      window.alert("No se pudo guardar.");
      return;
    }
    setFilas((prev) => prev && prev.map((f) => (f.tabla === fila.tabla && f.id === fila.id ? { ...f, [campo]: valor } : f)));

    if (campo !== "whatsapp_enviado") return;
    const clave = `${fila.tabla}-${fila.id}`;
    const timerExistente = timersRef.current.get(clave);
    if (timerExistente) {
      clearTimeout(timerExistente);
      timersRef.current.delete(clave);
    }
    if (!valor) return;
    const timer = setTimeout(() => {
      reproducirBeep();
      timersRef.current.delete(clave);
    }, ESPERA_BEEP_MS);
    timersRef.current.set(clave, timer);
  }

  async function copiarYAbrir(fila: FilaTanda) {
    if (!fila.telefono || !plantilla) return;
    const mensaje = reemplazarVariables(plantilla.cuerpo, fila.nombre, "whatsapp");
    window.open(waLink(fila.telefono, mensaje), "_blank");
    try {
      await navigator.clipboard.writeText(mensaje);
    } catch {
      window.alert("Se abrió WhatsApp, pero no se pudo copiar el mensaje automáticamente — pegalo a mano.");
    }
  }

  if (!tandaId) {
    return (
      <p className={`${panelCardClass} p-6 text-sm text-[var(--color-text-muted)]`}>
        Tanda inválida — volvé al panel de WhatsApp y armá una tanda de nuevo.
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
            <p className="text-sm whitespace-pre-line text-[var(--color-text-muted)] mb-3">{reemplazarVariables(plantilla.cuerpo, f.nombre, "whatsapp")}</p>
            <button type="button" onClick={() => copiarYAbrir(f)} disabled={!f.telefono} className={btnPrimaryClass}>
              Copiar mensaje y abrir WhatsApp
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
