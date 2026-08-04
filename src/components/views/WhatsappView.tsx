"use client";

import { useEffect, useState } from "react";
import { MensajePredefinido } from "@/data/mensajes";
import { useContactosUnificados } from "@/lib/useContactosUnificados";
import FiltrosContactos, { FILTRO_VACIO, FiltroContactosState, aplicaFiltro } from "@/components/FiltrosContactos";
import { fieldLabelClass, fieldInputClass, btnPrimaryClass, panelCardClass } from "@/components/formStyles";

const TAMANO_TANDA_DEFAULT = 20;
const TAMANO_TANDA_MAX = 25;

export default function WhatsappView() {
  const { unificados } = useContactosUnificados();
  const [filtro, setFiltro] = useState<FiltroContactosState>(FILTRO_VACIO);
  const [stats, setStats] = useState<{ total: number; elegibles: number } | null>(null);

  const [plantillas, setPlantillas] = useState<MensajePredefinido[] | null>(null);
  const [plantillaId, setPlantillaId] = useState("");
  const [tamano, setTamano] = useState(TAMANO_TANDA_DEFAULT);

  useEffect(() => {
    fetch("/api/admin/mensajes?canal=whatsapp")
      .then((r) => r.json())
      .then((data) => setPlantillas(Array.isArray(data) ? data : []));
  }, []);

  const plantilla = plantillas?.find((m) => m.id === plantillaId) ?? null;

  function elegiblesActuales() {
    if (!unificados) return [];
    return unificados.filter((r) => aplicaFiltro(r, filtro) && r.telefono && !r.whatsappEnviado && !r.whatsappSinWa);
  }

  function aplicarFiltro() {
    if (!unificados) return;
    const total = unificados.filter((r) => aplicaFiltro(r, filtro)).length;
    setStats({ total, elegibles: elegiblesActuales().length });
  }

  function abrirTanda() {
    if (!plantilla) return;
    const tanda = elegiblesActuales().slice(0, tamano);
    if (tanda.length === 0) {
      window.alert("Ningún contacto elegible con ese filtro — ya están todos marcados como enviados o sin WhatsApp.");
      return;
    }
    const items = tanda.map((c) => `${c.tabla}:${c.id}`).join(",");
    window.open(`/whatsapp-tanda?plantilla=${encodeURIComponent(plantilla.id)}&items=${encodeURIComponent(items)}`, "_blank");
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--color-brand-dark)]">WhatsApp</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Elegí a qué contactos les llega, después armás la tanda</p>
      </div>

      <div className={`${panelCardClass} p-4 mb-6`}>
        <h3 className="type-label text-[var(--color-text-muted)] mb-3">Filtro de contactos</h3>
        <FiltrosContactos rows={unificados ?? []} value={filtro} onChange={setFiltro} onFiltrar={aplicarFiltro} />
        {stats && (
          <p className="text-sm text-[var(--color-text-muted)] mt-3">
            <strong className="text-[var(--color-brand-dark)]">{stats.total}</strong> contacto{stats.total === 1 ? "" : "s"} coinciden con el filtro —{" "}
            <strong className="text-[var(--color-brand-dark)]">{stats.elegibles}</strong> disponibles para WhatsApp
          </p>
        )}
        {!stats && <p className="text-sm text-[var(--color-text-muted)] mt-3">Elegí los filtros y tocá &quot;Filtrar&quot; para ver a cuántos contactos les llega.</p>}
      </div>

      <div className={`${panelCardClass} p-4 sm:p-6 flex flex-col gap-5`}>
        <h3 className="type-label text-[var(--color-text-muted)]">Mensaje y tanda</h3>

        <div className="flex flex-wrap gap-4">
          <label className="flex-1 min-w-[240px]">
            <span className={fieldLabelClass}>Mensaje predefinido</span>
            <select className={fieldInputClass} value={plantillaId} onChange={(e) => setPlantillaId(e.target.value)}>
              <option value="">Elegí un mensaje del catálogo</option>
              {plantillas?.map((m) => (
                <option key={m.id} value={m.id}>{m.titulo}</option>
              ))}
            </select>
          </label>
          <label className="w-48">
            <span className={fieldLabelClass}>Tamaño de tanda (máx. {TAMANO_TANDA_MAX})</span>
            <input
              className={fieldInputClass}
              type="number"
              min={1}
              max={TAMANO_TANDA_MAX}
              value={tamano}
              onChange={(e) => setTamano(Math.min(TAMANO_TANDA_MAX, Math.max(1, Number(e.target.value) || TAMANO_TANDA_DEFAULT)))}
            />
          </label>
        </div>

        {plantilla && (
          <div>
            <span className={fieldLabelClass}>Vista previa</span>
            <div className="max-w-sm p-4 rounded-2xl bg-[var(--color-brand-dark)] text-white">
              <p className="text-sm whitespace-pre-line">{plantilla.cuerpo}</p>
            </div>
          </div>
        )}

        <div>
          <button type="button" onClick={abrirTanda} disabled={!plantilla} className={btnPrimaryClass}>
            Abrir tanda en WhatsApp
          </button>
          <p className="text-sm text-[var(--color-text-muted)] mt-3">
            Se abre una pestaña nueva con los contactos de la tanda. Los que se marquen ahí como &quot;Enviado&quot; o &quot;Sin
            WhatsApp&quot; quedan asentados en la base y no vuelven a aparecer en la próxima tanda.
          </p>
        </div>
      </div>
    </div>
  );
}
