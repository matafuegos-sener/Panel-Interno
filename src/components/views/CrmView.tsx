"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Accion, Contacto, Interaccion, TIPO_INTERACCION } from "@/data/crm";
import { AtajoCrm, CATEGORIA_LABEL, ContactoUnificado, ESTADO_CRM_LABEL, FILTRO_VACIO, FiltroContactosState, unificarDesdeContactos } from "@/data/crmUnificado";
import { useContactosUnificados } from "@/lib/useContactosUnificados";
import FiltrosContactos from "@/components/FiltrosContactos";
import Modal from "@/components/Modal";
import { fieldLabelClass, fieldInputClass, btnPrimaryClass, btnSecondaryClass, panelCardClass } from "@/components/formStyles";

function fmtFecha(d: string): string {
  return new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const WHATSAPP_LABEL: Record<string, string> = { SI: "Sí", NO: "No", VERIFICAR: "A verificar" };

const CAP_LOTE = 100;

const ATAJOS: { valor: AtajoCrm; label: string }[] = [
  { valor: "tocados_recientes", label: "Actividad reciente" },
  { valor: "semana", label: "Contactados esta semana" },
  { valor: "acciones_pendientes", label: "Acciones pendientes" },
];

export default function CrmView() {
  const { opciones, error, buscarLote, buscarAtajo } = useContactosUnificados();
  const [filtro, setFiltro] = useState<FiltroContactosState>(FILTRO_VACIO);
  const [atajoActivo, setAtajoActivo] = useState<AtajoCrm | null>(null);
  const [lote, setLote] = useState<ContactoUnificado[] | null>(null);
  const [totalLote, setTotalLote] = useState(0);
  const [cargandoLote, setCargandoLote] = useState(false);
  const [seleccionado, setSeleccionado] = useState<ContactoUnificado | null>(null);
  const [nuevoAbierto, setNuevoAbierto] = useState(false);

  const columnaAtajoLabel = atajoActivo === "acciones_pendientes" ? "Próxima acción" : atajoActivo ? "Última acción" : null;

  // El filtro manual y los atajos son dos caminos que nunca se combinan --
  // apretar uno pisa al otro, así siempre queda claro cuál trajo el lote.
  async function traerLote() {
    setAtajoActivo(null);
    setCargandoLote(true);
    const encontrados = await buscarLote(filtro);
    setTotalLote(encontrados.length);
    setLote(encontrados.slice(0, CAP_LOTE));
    setCargandoLote(false);
  }

  async function traerAtajo(atajo: AtajoCrm) {
    setFiltro(FILTRO_VACIO);
    setAtajoActivo(atajo);
    setCargandoLote(true);
    const encontrados = await buscarAtajo(atajo);
    setTotalLote(encontrados.length);
    setLote(encontrados.slice(0, CAP_LOTE));
    setCargandoLote(false);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-brand-dark)]">CRM</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Traé un lote por criterio y trabajalo — no navegues la base entera</p>
        </div>
        <button type="button" onClick={() => setNuevoAbierto(true)} className={btnPrimaryClass}>
          + Nuevo contacto
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6">
          No se pudo cargar la base: {error}. Probablemente falta aplicar la migración en Supabase (ver pendientes.md).
        </p>
      )}

      <div className={`${panelCardClass} p-4 mb-4`}>
        <FiltrosContactos
          opciones={opciones ?? { categorias: [], rubros: [], tiers: [] }}
          value={filtro}
          onChange={setFiltro}
          onFiltrar={traerLote}
          mostrarBusqueda
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        {ATAJOS.map((a) => (
          <button
            key={a.valor}
            type="button"
            onClick={() => traerAtajo(a.valor)}
            className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors duration-200 ${
              atajoActivo === a.valor
                ? "bg-[var(--color-brand-red)] border-[var(--color-brand-red)] text-white"
                : "border-[var(--color-border)] text-[var(--color-brand-gray)] hover:border-[var(--color-brand-red)] hover:text-[var(--color-brand-red)]"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {cargandoLote && <p className="text-sm text-[var(--color-text-muted)] py-12 text-center">Buscando contactos…</p>}

      {!cargandoLote && lote === null && (
        <p className="text-sm text-[var(--color-text-muted)] py-12 text-center border border-dashed border-[var(--color-border)] rounded-2xl">
          Elegí un criterio y cargá el lote para empezar a trabajar.
        </p>
      )}

      {!cargandoLote && lote !== null && lote.length === 0 && (
        <p className="text-sm text-[var(--color-text-muted)] py-12 text-center border border-dashed border-[var(--color-border)] rounded-2xl">
          Ningún contacto coincide con ese criterio.
        </p>
      )}

      {!cargandoLote && lote !== null && lote.length > 0 && (
        <>
          <p className="type-label text-[var(--color-text-muted)] mb-3">
            {totalLote} contacto{totalLote === 1 ? "" : "s"} coinciden con el filtro — mostrando {lote.length}, hacé click para abrir cada uno
          </p>
          <div className={`${panelCardClass} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--color-surface-subtle)] border-b border-[var(--color-border)]">
                    <th className="text-left px-4 py-3 type-label text-[var(--color-text-muted)]">Empresa</th>
                    <th className="text-left px-4 py-3 type-label text-[var(--color-text-muted)]">Rubro</th>
                    <th className="text-left px-4 py-3 type-label text-[var(--color-text-muted)]">Tier</th>
                    <th className="text-left px-4 py-3 type-label text-[var(--color-text-muted)]">Categoría</th>
                    <th className="text-left px-4 py-3 type-label text-[var(--color-text-muted)]">Estado CRM</th>
                    <th className="text-left px-4 py-3 type-label text-[var(--color-text-muted)]">Teléfono</th>
                    {columnaAtajoLabel && (
                      <th className="text-left px-4 py-3 type-label text-[var(--color-text-muted)]">{columnaAtajoLabel}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {lote.map((r) => (
                    <tr
                      key={`${r.tabla}-${r.id}`}
                      className="border-b border-[var(--color-border-subtle)] last:border-0 cursor-pointer hover:bg-[var(--color-surface-subtle)] transition-colors"
                      onClick={() => setSeleccionado(r)}
                    >
                      <td className="px-4 py-3 font-medium text-[var(--color-brand-dark)]">{r.nombre}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)]">{r.rubro || "—"}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)]">{r.tier || "—"}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)]">
                        {CATEGORIA_LABEL[r.categoria] ?? r.categoria}
                        {r.categoriaFecha && <span className="block text-xs">{fmtFecha(r.categoriaFecha)}</span>}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)]">
                        {r.estadoCrm ? ESTADO_CRM_LABEL[r.estadoCrm] ?? r.estadoCrm : "—"}
                        {r.estadoCrmFecha && <span className="block text-xs">{fmtFecha(r.estadoCrmFecha)}</span>}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)]">{r.telefono || <em className="text-xs">sin dato</em>}</td>
                      {columnaAtajoLabel && (
                        <td className="px-4 py-3 text-[var(--color-text-muted)]">{r.fechaAtajo ? fmtFecha(r.fechaAtajo) : "—"}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Modal open={seleccionado !== null} onClose={() => setSeleccionado(null)} maxWidthClass="max-w-2xl">
        {seleccionado && <ContactoPanel unificado={seleccionado} onClose={() => setSeleccionado(null)} />}
      </Modal>

      <Modal open={nuevoAbierto} onClose={() => setNuevoAbierto(false)}>
        <PanelNuevoContacto
          onCreado={(unificado) => {
            setNuevoAbierto(false);
            setSeleccionado(unificado);
          }}
          onCancelar={() => setNuevoAbierto(false)}
        />
      </Modal>
    </div>
  );
}

// Alta manual -- timbre del taller, llamada entrante, orgánico de la web:
// contactos que no vienen de ninguna base scrapeada. Siempre va a
// `contactos` (ver POST /api/admin/crm/contactos), nunca a `leads_base`.
// Al crear, abre directo el ContactoPanel del contacto nuevo para que se
// pueda registrar la interacción de una.
function PanelNuevoContacto({
  onCreado,
  onCancelar,
}: {
  onCreado: (u: ContactoUnificado) => void;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [rubro, setRubro] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [personaContacto, setPersonaContacto] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    if (!nombre.trim()) return;
    setGuardando(true);
    const res = await fetch("/api/admin/crm/contactos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombre.trim(), rubro, telefono, email, personaContacto }),
    });
    const data = await res.json();
    setGuardando(false);
    if (!res.ok) {
      window.alert(`Error: ${data.error}`);
      return;
    }
    onCreado(unificarDesdeContactos(data as Contacto));
  }

  return (
    <div className={`${panelCardClass} p-6 sm:p-8`}>
      <h2 className="text-lg font-bold text-[var(--color-brand-dark)] mb-4">Nuevo contacto</h2>
      <p className="text-sm text-[var(--color-text-muted)] mb-4">
        Para alguien que no está en ninguna base — tocó el timbre, llamó, o llegó orgánico por la web.
      </p>
      <div className="flex flex-col gap-4">
        <label>
          <span className={fieldLabelClass}>Nombre / Empresa</span>
          <input className={fieldInputClass} value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        </label>
        <label>
          <span className={fieldLabelClass}>Rubro</span>
          <input className={fieldInputClass} value={rubro} onChange={(e) => setRubro(e.target.value)} placeholder="Ej: consorcio, geriátrico…" />
        </label>
        <div className="flex flex-wrap gap-4">
          <label className="flex-1 min-w-[180px]">
            <span className={fieldLabelClass}>Teléfono</span>
            <input className={fieldInputClass} value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </label>
          <label className="flex-1 min-w-[180px]">
            <span className={fieldLabelClass}>Mail</span>
            <input className={fieldInputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
        </div>
        <label>
          <span className={fieldLabelClass}>Persona de contacto</span>
          <input className={fieldInputClass} value={personaContacto} onChange={(e) => setPersonaContacto(e.target.value)} placeholder="Quién atiende" />
        </label>

        <div className="flex gap-3 pt-2 border-t border-[var(--color-border-subtle)]">
          <button type="button" onClick={guardar} disabled={!nombre.trim() || guardando} className={btnPrimaryClass}>
            {guardando ? "Guardando…" : "Guardar y abrir"}
          </button>
          <button type="button" onClick={onCancelar} className={btnSecondaryClass}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

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

function ContactoPanel({ unificado, onClose }: { unificado: ContactoUnificado; onClose: () => void }) {
  const { id, tabla } = unificado;
  const [camposExtra, setCamposExtra] = useState<CamposExtra | null>(null);
  const [interacciones, setInteracciones] = useState<Interaccion[] | null>(null);
  const [acciones, setAcciones] = useState<Accion[]>([]);
  const [nombreContacto, setNombreContacto] = useState("");
  const [guardandoContacto, setGuardandoContacto] = useState(false);

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
        if (!nombreContactoInicializado.current) {
          setNombreContacto(data.fila?.contacto ?? "");
          nombreContactoInicializado.current = true;
        }
      });
  }

  useEffect(() => {
    cargarHistorial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tabla]);

  async function guardarContacto() {
    setGuardandoContacto(true);
    await fetch(`/api/admin/crm/contactos/${id}?tabla=${tabla}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contacto: nombreContacto.trim() || null }),
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
    await fetch(`/api/admin/crm/contactos/${id}/interacciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tabla, tipo, detalle: detalle.trim(), acciones }),
    });
    setDetalle("");
    setAccionesFuturas([{ accion: "", texto: "", fecha_ejecucion: "" }]);
    setRegistrando(false);
    cargarHistorial();
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
        <p className="text-sm text-[var(--color-text-muted)]"><span className="type-label mr-1">Tel</span>{unificado.telefono || "sin dato"}</p>
        <p className="text-sm text-[var(--color-text-muted)]"><span className="type-label mr-1">Mail</span>{unificado.email || "sin dato"}</p>
        <button type="button" onClick={guardarContacto} disabled={guardandoContacto} className={btnSecondaryClass}>
          Guardar persona de contacto
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
              <div key={i} className="flex flex-wrap gap-2 w-full">
                <input
                  className={`${fieldInputClass} flex-1 min-w-[140px]`}
                  placeholder="Acción — ej: llamar"
                  value={a.accion}
                  onChange={(e) => setAccionesFuturas((prev) => prev.map((x, idx) => (idx === i ? { ...x, accion: e.target.value } : x)))}
                />
                <input
                  className={`${fieldInputClass} flex-1 min-w-[140px]`}
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
