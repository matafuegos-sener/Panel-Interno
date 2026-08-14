"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { ACCION_OPCIONES, Accion, Interaccion, TIPO_INTERACCION } from "@/data/crm";
import { CATEGORIA_LABEL, ContactoUnificado, ESTADO_CRM_LABEL } from "@/data/crmUnificado";
import EnvioBadges from "@/components/EnvioBadges";
import { fmtFecha } from "@/lib/fechas";
import { fieldLabelClass, fieldInputClass, btnPrimaryClass, btnSecondaryClass, panelCardClass } from "@/components/formStyles";

const WHATSAPP_LABEL: Record<string, string> = { SI: "Sí", NO: "No", VERIFICAR: "A verificar" };

// Campos "extra" uniformados entre contactos y leads_base (0006_uniformar_base.sql)
// -- mismo nombre de campo en las dos tablas, exista o no el dato.
interface CamposExtra {
  ciudad: string | null;
  direccion: string | null;
  whatsapp: string | null;
  website: string | null;
  red_social: string | null;
  rating: number | null;
  reviews: number | null;
  matricula: string | null;
  fecha_inscripcion: string | null;
  notas: string | null;
}

// Ficha completa de un contacto -- historial, campos extra, registrar
// interacción. Se usa desde CrmView (al hacer click en una fila del lote) y
// desde AgendaView (al hacer click en el nombre de la empresa dentro de un
// evento con seguimiento CRM) -- antes solo existía en CrmView, un evento de
// agenda no tenía forma de llegar a la ficha completa de la empresa.
export default function ContactoPanel({ unificado, onClose }: { unificado: ContactoUnificado; onClose: () => void }) {
  const { id, tabla } = unificado;
  const [camposExtra, setCamposExtra] = useState<CamposExtra | null>(null);
  const [interacciones, setInteracciones] = useState<Interaccion[] | null>(null);
  const [acciones, setAcciones] = useState<Accion[]>([]);
  const [nombreContacto, setNombreContacto] = useState("");
  const [email, setEmail] = useState("");
  const [guardandoContacto, setGuardandoContacto] = useState(false);
  const [llamadaRealizada, setLlamadaRealizada] = useState(unificado.llamadaRealizada);
  const [llamadaRealizadaEn, setLlamadaRealizadaEn] = useState(unificado.llamadaRealizadaEn);
  const [marcandoLlamada, setMarcandoLlamada] = useState(false);

  const [mostrarInfo, setMostrarInfo] = useState(false);

  const [tipo, setTipo] = useState(Object.keys(TIPO_INTERACCION)[0]);
  const [detalle, setDetalle] = useState("");
  const [accionesFuturas, setAccionesFuturas] = useState([{ accion: "", texto: "", fecha_ejecucion: "" }]);
  const [registrando, setRegistrando] = useState(false);
  const nombreContactoInicializado = useRef(false);
  const hoyLabel = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

  function cargarHistorial() {
    fetch(`/api/admin/crm/contactos/${id}?tabla=${tabla}`)
      .then((r) => r.json())
      .then((data) => {
        setInteracciones(data.interacciones ?? []);
        setAcciones(data.acciones ?? []);
        setCamposExtra(data.fila ?? null);
        setLlamadaRealizada(Boolean(data.fila?.llamada_realizada));
        setLlamadaRealizadaEn(data.fila?.llamada_realizada_en ?? null);
        if (!nombreContactoInicializado.current) {
          setNombreContacto(data.fila?.contacto ?? "");
          // columna real difiere entre tablas -- ver PATCH en
          // /api/admin/crm/contactos/[id]
          setEmail(data.fila?.mail_1 ?? data.fila?.email ?? "");
          nombreContactoInicializado.current = true;
        }
      });
  }

  useEffect(() => {
    cargarHistorial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tabla]);

  // Registra que se llamó -- de un solo sentido, ver comentario en
  // /api/admin/crm/contactos/[id]/estado (PATCH ignora `false`).
  async function marcarLlamada() {
    if (llamadaRealizada || marcandoLlamada) return;
    setMarcandoLlamada(true);
    const res = await fetch(`/api/admin/crm/contactos/${id}/estado`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tabla, llamada_realizada: true }),
    });
    setMarcandoLlamada(false);
    if (!res.ok) {
      window.alert("No se pudo registrar la llamada. Probá de nuevo.");
      return;
    }
    setLlamadaRealizada(true);
    setLlamadaRealizadaEn(new Date().toISOString());
  }

  async function guardarContacto() {
    setGuardandoContacto(true);
    await fetch(`/api/admin/crm/contactos/${id}?tabla=${tabla}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contacto: nombreContacto.trim() || null, email: email.trim() || null }),
    });
    setGuardandoContacto(false);
  }

  async function registrarInteraccion(e: React.FormEvent) {
    e.preventDefault();
    setRegistrando(true);
    // `acciones` en la tabla solo tiene una descripción de texto -- acá se
    // arman a partir de los dos campos que se ven en pantalla (acción corta +
    // detalle opcional) para no necesitar una columna nueva.
    const acciones = accionesFuturas
      .filter((a) => a.accion.trim() && a.fecha_ejecucion)
      .map((a) => ({
        descripcion: a.texto.trim() ? `${a.accion.trim()} — ${a.texto.trim()}` : a.accion.trim(),
        fecha_ejecucion: a.fecha_ejecucion,
      }));
    const res = await fetch(`/api/admin/crm/contactos/${id}/interacciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tabla, tipo, detalle: detalle.trim(), acciones }),
    });
    setRegistrando(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      window.alert(`Error al registrar: ${data?.error ?? res.statusText}`);
      return;
    }
    onClose();
  }

  const camposTracking: [string, string | number | null][] = camposExtra
    ? [
        ["Ciudad", camposExtra.ciudad],
        ["Dirección", camposExtra.direccion],
        ["¿Tiene WhatsApp?", camposExtra.whatsapp ? WHATSAPP_LABEL[camposExtra.whatsapp] ?? camposExtra.whatsapp : null],
        ["Website", camposExtra.website],
        ["Red social", camposExtra.red_social],
        ["Rating", camposExtra.rating],
        ["Reviews", camposExtra.reviews],
        ["Matrícula", camposExtra.matricula],
        ["Fecha inscripción", camposExtra.fecha_inscripcion],
        ["Notas", camposExtra.notas],
      ]
    : [];

  return (
    <div className={`${panelCardClass} p-6 sm:p-8`}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-[var(--color-brand-dark)]">{unificado.nombre}</h2>
            {camposTracking.some(([, valor]) => valor !== null && valor !== undefined && valor !== "") && (
              <button
                type="button"
                onClick={() => setMostrarInfo((v) => !v)}
                className="text-xs font-medium text-[var(--color-brand-red)] hover:underline"
              >
                {mostrarInfo ? "− Info" : "+ Info"}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1">
            <span className="inline-block px-1.5 py-0.5 rounded text-xs border border-[var(--color-border)] text-[var(--color-text-muted)]">
              {CATEGORIA_LABEL[unificado.categoria] ?? unificado.categoria}
              {unificado.categoriaFecha && ` — ${fmtFecha(unificado.categoriaFecha)}`}
            </span>
            {unificado.estadoCrm && (
              <span className="inline-block px-1.5 py-0.5 rounded text-xs border border-[var(--color-brand-red-subtle)] text-[var(--color-brand-red)]">
                {ESTADO_CRM_LABEL[unificado.estadoCrm] ?? unificado.estadoCrm}
                {unificado.estadoCrmFecha && ` — ${fmtFecha(unificado.estadoCrmFecha)}`}
              </span>
            )}
            {unificado.vigenciaHasta && (
              <span className="inline-block px-1.5 py-0.5 rounded text-xs border border-[var(--color-border)] text-[var(--color-text-muted)]">
                {/* "activo" no se apaga solo al año (no hay cron) -- la fecha manda, no el flag guardado */}
                {unificado.vigenciaHasta >= new Date().toISOString().slice(0, 10) ? "Cliente activo hasta" : "Venció"} {fmtFecha(unificado.vigenciaHasta)}
              </span>
            )}
          </div>
          <div className="mt-1.5">
            <EnvioBadges
              mailEnviado={unificado.mailEnviado}
              mailEnviadoEn={unificado.mailEnviadoEn}
              whatsappEnviado={unificado.whatsappEnviado}
              whatsappEnviadoEn={unificado.whatsappEnviadoEn}
              whatsappSinWa={unificado.whatsappSinWa}
              llamadaRealizada={llamadaRealizada}
              llamadaRealizadaEn={llamadaRealizadaEn}
              onMarcarLlamada={marcarLlamada}
              marcandoLlamada={marcandoLlamada}
            />
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-[var(--color-brand-gray)] hover:text-[var(--color-brand-dark)]">
          <X className="w-5 h-5" />
        </button>
      </div>

      {mostrarInfo && (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mb-6 pb-6 border-b border-[var(--color-border-subtle)]">
          {camposTracking
            .filter(([, valor]) => valor !== null && valor !== undefined && valor !== "")
            .map(([label, valor]) => (
              <div key={label}>
                <dt className="type-label text-[var(--color-text-muted)]">{label}</dt>
                <dd className="text-sm text-[var(--color-brand-dark)]">
                  {label === "Website" || label === "Red social" ? (
                    <a href={String(valor)} target="_blank" rel="noreferrer" className="text-[var(--color-brand-red)] hover:underline break-all">
                      {valor}
                    </a>
                  ) : (
                    valor
                  )}
                </dd>
              </div>
            ))}
        </dl>
      )}

      <div className="flex flex-wrap items-end gap-4 pb-6 mb-6 border-b border-[var(--color-border-subtle)]">
        <label className="min-w-[200px]">
          <span className={fieldLabelClass}>Persona de contacto</span>
          <input className={fieldInputClass} value={nombreContacto} onChange={(e) => setNombreContacto(e.target.value)} placeholder="Nombre de quien atiende" />
        </label>
        <div className="flex flex-col gap-1">
          <p className="text-sm text-[var(--color-text-muted)]"><span className="type-label mr-1">Tel</span>{unificado.telefono || "sin dato"}</p>
          <label className="text-sm text-[var(--color-text-muted)] flex items-center">
            <span className="type-label mr-1">Mail</span>
            <input
              className="border-b border-[var(--color-border)] bg-transparent px-1 text-[var(--color-brand-dark)] focus:outline-none focus:border-[var(--color-brand-red)]"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sin dato"
            />
          </label>
        </div>
        <button type="button" onClick={guardarContacto} disabled={guardandoContacto} className={btnSecondaryClass}>
          Guardar contacto
        </button>
      </div>

      {acciones.length > 0 && (
        <div className="p-4 rounded-lg bg-[var(--color-brand-red-subtle)] mb-6">
          <h3 className="type-label text-[var(--color-text-muted)] mb-2">Pendiente con este contacto</h3>
          {acciones.map((a) => (
            <p key={a.id} className="text-sm mb-1">
              {a.descripcion} — <strong>{fmtFecha(a.fecha_ejecucion)}</strong>
            </p>
          ))}
        </div>
      )}

      <form onSubmit={registrarInteraccion}>
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="type-label text-[var(--color-text-muted)]">Registrar contacto de hoy</h3>
            <span className="text-xs text-[var(--color-text-muted)]">Hoy · {hoyLabel}</span>
          </div>
          <div className="flex flex-col gap-2 items-start">
            <select className={`${fieldInputClass} w-full`} value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {Object.entries(TIPO_INTERACCION).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <textarea
              className={`${fieldInputClass} resize-y`}
              rows={2}
              placeholder="Qué se habló, qué pasó…"
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="mb-6 pt-6 border-t border-[var(--color-border-subtle)]">
          <h3 className="type-label text-[var(--color-text-muted)] mb-3">Acciones futuras</h3>
          <div className="flex flex-col gap-2 items-start w-full">
            {accionesFuturas.map((a, i) => (
              <div key={i} className="flex flex-col gap-2 w-full pb-4 border-b border-[var(--color-border-subtle)] last:border-0 last:pb-0">
                <select
                  className={fieldInputClass}
                  value={a.accion}
                  onChange={(e) => setAccionesFuturas((prev) => prev.map((x, idx) => (idx === i ? { ...x, accion: e.target.value } : x)))}
                >
                  <option value="">Acción — elegir</option>
                  {ACCION_OPCIONES.map((op) => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>
                <textarea
                  className={`${fieldInputClass} resize-y`}
                  rows={2}
                  placeholder="Detalle (opcional)"
                  value={a.texto}
                  onChange={(e) => setAccionesFuturas((prev) => prev.map((x, idx) => (idx === i ? { ...x, texto: e.target.value } : x)))}
                />
                <input
                  type="date"
                  className={fieldInputClass}
                  value={a.fecha_ejecucion}
                  onChange={(e) => setAccionesFuturas((prev) => prev.map((x, idx) => (idx === i ? { ...x, fecha_ejecucion: e.target.value } : x)))}
                />
              </div>
            ))}
            <button
              type="button"
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-brand-red)] underline"
              onClick={() => setAccionesFuturas((prev) => [...prev, { accion: "", texto: "", fecha_ejecucion: "" }])}
            >
              + agregar otra acción
            </button>
          </div>
        </div>

        <button type="submit" disabled={registrando} className={btnPrimaryClass}>
          {registrando ? "Registrando…" : "Registrar"}
        </button>
      </form>

      <div>
        <h3 className="type-label text-[var(--color-text-muted)] mb-3">Historial</h3>
        {interacciones === null && <p className="text-sm text-[var(--color-text-muted)]">Cargando…</p>}
        {interacciones && interacciones.length === 0 && (
          <p className="text-sm text-[var(--color-text-muted)]">Sin interacciones registradas todavía.</p>
        )}
        <div className="flex flex-col gap-3">
          {interacciones?.map((it) => (
            <div key={it.id} className="p-3 rounded-lg bg-[var(--color-bg-warm)] border border-[var(--color-border-subtle)]">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs text-[var(--color-text-muted)]">{fmtFecha(it.fecha)}</span>
                <span className="text-xs px-1.5 py-0.5 border border-[var(--color-border)] rounded">{TIPO_INTERACCION[it.tipo] ?? it.tipo}</span>
              </div>
              <p className="text-sm mb-1">{it.detalle}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{it.registrado_por}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
