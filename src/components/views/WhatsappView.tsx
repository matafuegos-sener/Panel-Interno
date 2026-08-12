"use client";

import { useEffect, useMemo, useState } from "react";
import { ContactoUnificado, FILTRO_VACIO, FiltroContactosState } from "@/data/crmUnificado";
import { CATEGORIA_PROSPECTO_CERO } from "@/data/crm";
import { MensajePredefinido } from "@/data/mensajes";
import { useContactosUnificados } from "@/lib/useContactosUnificados";
import FiltrosContactos from "@/components/FiltrosContactos";
import { fieldLabelClass, fieldInputClass, btnPrimaryClass, panelCardClass } from "@/components/formStyles";

const TAMANO_TANDA_DEFAULT = 20;
const TAMANO_TANDA_MAX = 25;

export default function WhatsappView() {
  const { opciones, error, buscarLote } = useContactosUnificados();
  const [filtro, setFiltro] = useState<FiltroContactosState>(FILTRO_VACIO);
  const [loteActual, setLoteActual] = useState<ContactoUnificado[] | null>(null);
  const [cargandoFiltro, setCargandoFiltro] = useState(false);

  const [plantillas, setPlantillas] = useState<MensajePredefinido[] | null>(null);
  const [plantillaId, setPlantillaId] = useState("");
  const [tamano, setTamano] = useState(TAMANO_TANDA_DEFAULT);
  const [abriendo, setAbriendo] = useState(false);

  useEffect(() => {
    fetch("/api/admin/mensajes?canal=whatsapp")
      .then((r) => r.json())
      .then((data) => setPlantillas(Array.isArray(data) ? data : []));
  }, []);

  const plantilla = plantillas?.find((m) => m.id === plantillaId) ?? null;

  // Nunca mandar una tanda masiva a un contacto que ya se está trabajando --
  // "frío" es la única categoría elegible acá, sin excepción (ver
  // conversación 2026-08-05: no puede llegarle un mensaje promocional a
  // alguien como si fuera un contacto nuevo). El Categoría del filtro de
  // arriba ni se muestra en esta vista por eso -- no tiene sentido ofrecer
  // una combinación que siempre da cero resultados.
  function elegiblesActuales() {
    if (!loteActual) return [];
    return loteActual.filter((r) => r.telefono && !r.whatsappEnviado && !r.whatsappSinWa && r.categoria === CATEGORIA_PROSPECTO_CERO);
  }

  const stats = useMemo(() => {
    if (!loteActual) return null;
    return { total: loteActual.length, elegibles: elegiblesActuales().length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loteActual]);

  async function aplicarFiltro() {
    setCargandoFiltro(true);
    setLoteActual(await buscarLote(filtro));
    setCargandoFiltro(false);
  }

  async function abrirTanda() {
    if (!plantilla) return;
    if (!loteActual) {
      window.alert("Todavía no filtraste contactos — elegí los filtros y tocá \"Filtrar\" antes de abrir la tanda.");
      return;
    }
    const tanda = elegiblesActuales().slice(0, tamano);
    if (tanda.length === 0) {
      window.alert("Ningún contacto elegible con ese filtro — ya están todos marcados como enviados o sin WhatsApp.");
      return;
    }
    setAbriendo(true);
    const res = await fetch("/api/admin/whatsapp/tanda", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plantillaId: plantilla.id, items: tanda.map((c) => ({ id: c.id, tabla: c.tabla })) }),
    });
    const data = await res.json();
    setAbriendo(false);
    if (!res.ok) {
      window.alert(`Error: ${data.error}`);
      return;
    }
    window.open(`/whatsapp-tanda?tandaId=${data.tandaId}`, "_blank");
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--color-brand-dark)]">WhatsApp</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Elegí a qué contactos les llega, después armás la tanda</p>
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6">
          No se pudo cargar la base: {error}. Probablemente falta aplicar la migración en Supabase (ver pendientes.md).
        </p>
      )}

      <div className={`${panelCardClass} p-4 mb-6`}>
        <h3 className="type-label text-[var(--color-text-muted)] mb-3">Filtro de contactos</h3>
        <FiltrosContactos
          opciones={opciones ?? { categorias: [], rubros: [], tiers: [] }}
          value={filtro}
          onChange={setFiltro}
          onFiltrar={aplicarFiltro}
          mostrarCategoria={false}
        />
        {cargandoFiltro && <p className="text-sm text-[var(--color-text-muted)] mt-3">Buscando…</p>}
        {!cargandoFiltro && stats && (
          <p className="text-sm text-[var(--color-text-muted)] mt-3">
            <strong className="text-[var(--color-brand-dark)]">{stats.total}</strong> contacto{stats.total === 1 ? "" : "s"} coinciden con el filtro —{" "}
            <strong className="text-[var(--color-brand-dark)]">{stats.elegibles}</strong> fríos y disponibles para WhatsApp
          </p>
        )}
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
          <button type="button" onClick={abrirTanda} disabled={!plantilla || !loteActual || abriendo} className={btnPrimaryClass}>
            {abriendo ? "Abriendo…" : "Abrir tanda en WhatsApp"}
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
