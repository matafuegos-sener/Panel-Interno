"use client";

import { useEffect, useMemo, useState } from "react";
import { ContactoUnificado, FILTRO_VACIO, FiltroContactosState } from "@/data/crmUnificado";
import { MensajePredefinido } from "@/data/mensajes";
import { useContactosUnificados } from "@/lib/useContactosUnificados";
import { reemplazarVariables } from "@/lib/plantillas";
import FiltrosContactos from "@/components/FiltrosContactos";
import { fieldLabelClass, fieldInputClass, btnPrimaryClass, btnSecondaryClass, panelCardClass } from "@/components/formStyles";

const FIRMA_TEXTO = "Matafuegos Sener — Insumos y servicios contra incendios\n+54 11 5318-0515 · matafuegossener.com.ar";
const TAMANO_TANDA_DEFAULT = 15;
const TAMANO_TANDA_MAX = 25;

export default function EnviosMailView() {
  const { opciones, error, buscarLote } = useContactosUnificados();
  const [filtro, setFiltro] = useState<FiltroContactosState>(FILTRO_VACIO);
  const [loteActual, setLoteActual] = useState<ContactoUnificado[] | null>(null);
  const [cargandoFiltro, setCargandoFiltro] = useState(false);

  const [plantillas, setPlantillas] = useState<MensajePredefinido[] | null>(null);
  const [plantillaId, setPlantillaId] = useState("");
  const [asunto, setAsunto] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [tamano, setTamano] = useState(TAMANO_TANDA_DEFAULT);

  const [testMail, setTestMail] = useState(() => (typeof window !== "undefined" ? window.localStorage.getItem("sener_test_mail") ?? "" : ""));
  const [testNombre, setTestNombre] = useState(() => (typeof window !== "undefined" ? window.localStorage.getItem("sener_test_nombre") ?? "" : ""));
  const [enviandoTest, setEnviandoTest] = useState(false);
  const [mensajeTest, setMensajeTest] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ enviados: number; fallidos: { motivo: string }[] } | null>(null);

  useEffect(() => {
    fetch("/api/admin/mensajes?canal=mail")
      .then((r) => r.json())
      .then((data) => setPlantillas(Array.isArray(data) ? data : []));
  }, []);

  function onCambiarPlantilla(id: string) {
    setPlantillaId(id);
    const mensaje = plantillas?.find((m) => m.id === id);
    if (!mensaje) return;
    setAsunto(mensaje.asunto ?? "");
    setCuerpo(mensaje.cuerpo);
  }

  function elegiblesDe(lote: ContactoUnificado[]) {
    return lote.filter((r) => r.email && !r.mailEnviado);
  }

  function elegiblesActuales() {
    return loteActual ? elegiblesDe(loteActual) : [];
  }

  const stats = useMemo(() => {
    if (!loteActual) return null;
    return { total: loteActual.length, elegibles: elegiblesDe(loteActual).length };
  }, [loteActual]);

  // Ritmo de warm-up de este dominio (ver CLAUDE.md global, sección de
  // email): con un dominio sin historial no se manda todo junto. Estimación
  // simple y honesta -- una tanda por día, del tamaño elegido acá -- no hay
  // ningún cron todavía que escale solo, así que no se inventa un cálculo de
  // escalado automático que el sistema no ejecuta.
  const estimacion = useMemo(() => {
    if (!stats || stats.elegibles === 0) return null;
    const dias = Math.ceil(stats.elegibles / tamano);
    const fin = new Date();
    fin.setDate(fin.getDate() + (dias - 1));
    return { dias, fin: fin.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) };
  }, [stats, tamano]);

  async function aplicarFiltro() {
    setCargandoFiltro(true);
    setLoteActual(await buscarLote(filtro));
    setCargandoFiltro(false);
  }

  async function enviarTest() {
    if (!testMail.trim()) return;
    setEnviandoTest(true);
    setMensajeTest("");
    const nombre = testNombre.trim();
    const res = await fetch("/api/admin/mail/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destinatario: testMail.trim(),
        asunto: nombre ? reemplazarVariables(asunto, nombre) : asunto,
        cuerpo: `${nombre ? reemplazarVariables(cuerpo, nombre) : cuerpo}\n\n${FIRMA_TEXTO}`,
      }),
    });
    const data = await res.json();
    setMensajeTest(res.ok ? "Mail de test enviado." : `Error: ${data.error}`);
    setEnviandoTest(false);
  }

  async function enviarTanda() {
    const tanda = elegiblesActuales().slice(0, tamano);
    if (tanda.length === 0) {
      window.alert("Ningún contacto elegible con ese filtro — ya se les envió o no tienen email.");
      return;
    }
    setEnviando(true);
    setResultado(null);
    const res = await fetch("/api/admin/mail/enviar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        asunto,
        cuerpo: `${cuerpo}\n\n${FIRMA_TEXTO}`,
        items: tanda.map((c) => ({ id: c.id, tabla: c.tabla })),
      }),
    });
    const data = await res.json();
    setEnviando(false);
    if (!res.ok) {
      window.alert(`Error: ${data.error}`);
      return;
    }
    setResultado(data);
    await aplicarFiltro();
  }

  const puedeEnviar = asunto.trim() && cuerpo.trim() && !enviando;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--color-brand-dark)]">Envío de mails</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Elegí a qué contactos les llega, después redactás el mail</p>
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
        />
        {cargandoFiltro && <p className="text-sm text-[var(--color-text-muted)] mt-3">Buscando…</p>}
        {!cargandoFiltro && stats && (
          <p className="text-sm text-[var(--color-text-muted)] mt-3">
            <strong className="text-[var(--color-brand-dark)]">{stats.total}</strong> contacto{stats.total === 1 ? "" : "s"} coinciden con el filtro —{" "}
            <strong className="text-[var(--color-brand-dark)]">{stats.elegibles}</strong> tienen email y todavía no recibieron mail
            {estimacion && (
              <>
                {" "}— al ritmo de {tamano}/día, terminás en <strong className="text-[var(--color-brand-dark)]">{estimacion.dias}</strong> día
                {estimacion.dias === 1 ? "" : "s"} (fin estimado: <strong className="text-[var(--color-brand-dark)]">{estimacion.fin}</strong>)
              </>
            )}
          </p>
        )}
        {!cargandoFiltro && !stats && <p className="text-sm text-[var(--color-text-muted)] mt-3">Elegí los filtros y tocá &quot;Filtrar&quot; para ver a cuántos contactos les llega.</p>}
      </div>

      <div className={`${panelCardClass} p-4 sm:p-6 flex flex-col gap-5`}>
        <h3 className="type-label text-[var(--color-text-muted)]">Mensaje</h3>

        <label>
          <span className={fieldLabelClass}>Mensaje predefinido</span>
          <select className={fieldInputClass} value={plantillaId} onChange={(e) => onCambiarPlantilla(e.target.value)}>
            <option value="">Sin plantilla — redactar manualmente</option>
            {plantillas?.map((m) => (
              <option key={m.id} value={m.id}>{m.titulo}</option>
            ))}
          </select>
        </label>

        <label>
          <span className={fieldLabelClass}>Asunto</span>
          <input className={fieldInputClass} value={asunto} onChange={(e) => setAsunto(e.target.value)} />
        </label>

        <label>
          <span className={fieldLabelClass}>Contenido</span>
          <textarea className={`${fieldInputClass} resize-y`} rows={14} value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} />
        </label>

        <div className="p-4 rounded-lg bg-[var(--color-bg-warm)] border border-[var(--color-border-subtle)]">
          <span className={fieldLabelClass}>Firma (fija — se agrega sola al final del mail)</span>
          <p className="text-sm whitespace-pre-line text-[var(--color-brand-dark)]">{FIRMA_TEXTO}</p>
        </div>

        <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-[var(--color-border-subtle)]">
          <label className="max-w-xs">
            <span className={fieldLabelClass}>Tu mail (adónde llega la prueba)</span>
            <input
              className={fieldInputClass}
              type="email"
              placeholder="tu-mail@ejemplo.com"
              value={testMail}
              onChange={(e) => {
                setTestMail(e.target.value);
                window.localStorage.setItem("sener_test_mail", e.target.value.trim());
              }}
            />
          </label>
          <label className="max-w-xs">
            <span className={fieldLabelClass}>Nombre para reemplazar [EMPRESA]</span>
            <input
              className={fieldInputClass}
              type="text"
              placeholder="Consorcio Belgrano, o Juan Pérez…"
              value={testNombre}
              onChange={(e) => {
                setTestNombre(e.target.value);
                window.localStorage.setItem("sener_test_nombre", e.target.value);
              }}
            />
          </label>
          <button type="button" onClick={enviarTest} disabled={!testMail.trim() || !puedeEnviar || enviandoTest} className={btnSecondaryClass}>
            {enviandoTest ? "Enviando…" : "Enviar mail de test"}
          </button>
          {mensajeTest && <span className="text-sm text-[var(--color-text-muted)]">{mensajeTest}</span>}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="w-40">
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
          <button type="button" onClick={enviarTanda} disabled={!puedeEnviar} className={btnPrimaryClass}>
            {enviando ? "Enviando…" : "Enviar"}
          </button>
        </div>

        {resultado && (
          <p className="text-sm text-[var(--color-text-muted)]">
            {resultado.enviados} enviado{resultado.enviados === 1 ? "" : "s"}
            {resultado.fallidos.length > 0 && ` — ${resultado.fallidos.length} no se pudieron enviar`}
          </p>
        )}
      </div>
    </div>
  );
}
