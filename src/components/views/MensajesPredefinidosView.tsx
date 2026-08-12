"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2, X } from "lucide-react";
import { Canal, MensajePredefinido, MensajeInput } from "@/data/mensajes";
import Modal from "@/components/Modal";
import { fieldLabelClass, fieldInputClass, btnPrimaryClass, btnSecondaryClass, panelCardClass } from "@/components/formStyles";

const TITULOS: Record<Canal, string> = {
  mail: "Mensajes predefinidos — Mail",
  whatsapp: "Mensajes predefinidos — WhatsApp",
};

interface Props {
  canal: Canal;
}

export default function MensajesPredefinidosView({ canal }: Props) {
  const [mensajes, setMensajes] = useState<MensajePredefinido[] | null>(null);
  const [editando, setEditando] = useState<MensajePredefinido | "nuevo" | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/mensajes?canal=${canal}`)
      .then((r) => r.json())
      .then((data) => setMensajes(Array.isArray(data) ? data : []));
  }, [canal]);

  function onGuardado(mensaje: MensajePredefinido, esNuevo: boolean) {
    setMensajes((prev) => {
      if (!prev) return prev;
      return esNuevo ? [...prev, mensaje] : prev.map((m) => (m.id === mensaje.id ? mensaje : m));
    });
    setEditando(null);
  }

  async function eliminarMensaje(m: MensajePredefinido, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`¿Eliminar "${m.titulo}"? No se puede deshacer.`)) return;
    setEliminandoId(m.id);
    const res = await fetch(`/api/admin/mensajes/${m.id}`, { method: "DELETE" });
    setEliminandoId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(`Error al eliminar: ${data.error ?? res.statusText}`);
      return;
    }
    setMensajes((prev) => prev?.filter((x) => x.id !== m.id) ?? prev);
  }

  return (
    <div>
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-brand-dark)]">{TITULOS[canal]}</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Captación clientes — catálogo de plantillas</p>
        </div>
        <button className={btnPrimaryClass} type="button" onClick={() => setEditando("nuevo")}>
          + Nuevo mensaje
        </button>
      </div>

      {mensajes === null && (
        <p className="type-label text-[var(--color-text-muted)] py-12 text-center">Cargando catálogo…</p>
      )}

      {mensajes && mensajes.length === 0 && (
        <div className="text-center py-12 border border-dashed border-[var(--color-border)] rounded-2xl">
          <p className="text-sm text-[var(--color-text-muted)]">Todavía sin catálogo armado.</p>
        </div>
      )}

      {mensajes && mensajes.length > 0 && (
        <div className={`${panelCardClass} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-surface-subtle)] border-b border-[var(--color-border)]">
                  <th className="text-left px-4 py-3 type-label text-[var(--color-text-muted)]">Rubro</th>
                  <th className="text-left px-4 py-3 type-label text-[var(--color-text-muted)]">Título</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {mensajes.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-[var(--color-border-subtle)] last:border-0 cursor-pointer hover:bg-[var(--color-surface-subtle)] transition-colors"
                    onClick={() => setEditando(m)}
                  >
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded text-xs border border-[var(--color-brand-red-subtle)] text-[var(--color-brand-red)]">
                        {m.rubro}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-brand-dark)] max-w-[480px] truncate">{m.titulo}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={(e) => eliminarMensaje(m, e)}
                        disabled={eliminandoId === m.id}
                        className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                        aria-label="Eliminar mensaje"
                        title="Eliminar mensaje"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={editando !== null} onClose={() => setEditando(null)} maxWidthClass="max-w-2xl">
        {editando && (
          <MensajeForm
            canal={canal}
            mensaje={editando === "nuevo" ? null : editando}
            onClose={() => setEditando(null)}
            onGuardado={onGuardado}
          />
        )}
      </Modal>
    </div>
  );
}

function MensajeForm({
  canal,
  mensaje,
  onClose,
  onGuardado,
}: {
  canal: Canal;
  mensaje: MensajePredefinido | null;
  onClose: () => void;
  onGuardado: (mensaje: MensajePredefinido, esNuevo: boolean) => void;
}) {
  const [titulo, setTitulo] = useState(mensaje?.titulo ?? "");
  const [rubro, setRubro] = useState(mensaje?.rubro ?? "");
  const [asunto, setAsunto] = useState(mensaje?.asunto ?? "");
  const [cuerpo, setCuerpo] = useState(mensaje?.cuerpo ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Envuelve la selección actual del textarea con prefijo/sufijo (ej. ** **
  // para negrita) -- si no hay nada seleccionado, inserta un texto de
  // referencia para que el usuario lo reemplace.
  function envolverSeleccion(prefijo: string, sufijo: string, textoPorDefecto: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const inicio = textarea.selectionStart;
    const fin = textarea.selectionEnd;
    const seleccionado = cuerpo.slice(inicio, fin) || textoPorDefecto;
    setCuerpo(cuerpo.slice(0, inicio) + prefijo + seleccionado + sufijo + cuerpo.slice(fin));
    requestAnimationFrame(() => {
      textarea.focus();
      const nuevaPosicion = inicio + prefijo.length + seleccionado.length + sufijo.length;
      textarea.setSelectionRange(nuevaPosicion, nuevaPosicion);
    });
  }

  function insertarEnCursor(texto: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const inicio = textarea.selectionStart;
    const fin = textarea.selectionEnd;
    setCuerpo(cuerpo.slice(0, inicio) + texto + cuerpo.slice(fin));
    requestAnimationFrame(() => {
      textarea.focus();
      const nuevaPosicion = inicio + texto.length;
      textarea.setSelectionRange(nuevaPosicion, nuevaPosicion);
    });
  }

  // Mail soporta HTML real (**negrita** -> <strong>, [texto](url) -> <a>,
  // ver lib/plantillas.ts). WhatsApp no interpreta markdown -- su negrita
  // real es *un solo asterisco*, y un link ahí es la URL pelada, WhatsApp la
  // auto-detecta y la previsualiza sola, no admite texto de anchor.
  const URL_SITIO = "https://matafuegossener.com.ar";

  function aplicarNegrita() {
    const marca = canal === "whatsapp" ? "*" : "**";
    envolverSeleccion(marca, marca, "texto");
  }

  // Mismo gesto que Negrita: un click, sin diálogo. La URL del sitio es
  // siempre la misma para esta campaña, no hace falta preguntarla cada vez.
  function aplicarLink() {
    if (canal === "whatsapp") {
      insertarEnCursor(URL_SITIO);
      return;
    }
    envolverSeleccion("[", `](${URL_SITIO})`, "texto del link");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError("");

    const input: MensajeInput = { canal, titulo: titulo.trim(), rubro: rubro.trim(), asunto: canal === "mail" ? asunto.trim() : null, cuerpo: cuerpo.trim() };
    const url = mensaje ? `/api/admin/mensajes/${mensaje.id}` : "/api/admin/mensajes";
    const method = mensaje ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar");
      onGuardado(data as MensajePredefinido, !mensaje);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className={`${panelCardClass} p-6 sm:p-8`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-[var(--color-brand-dark)]">{mensaje ? "Editar mensaje" : "Nuevo mensaje"}</h2>
        <button type="button" onClick={onClose} className="text-[var(--color-brand-gray)] hover:text-[var(--color-brand-dark)]">
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <label>
          <span className={fieldLabelClass}>Título — concepto corto para identificarlo en la lista</span>
          <input
            className={fieldInputClass}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Mensaje — Industrias"
            required
          />
        </label>

        <label>
          <span className={fieldLabelClass}>Rubro — a quién está dirigido</span>
          <input
            className={fieldInputClass}
            value={rubro}
            onChange={(e) => setRubro(e.target.value)}
            placeholder="Consorcios, geriátricos, talleres…"
            required
          />
        </label>

        {canal === "mail" && (
          <label>
            <span className={fieldLabelClass}>Asunto</span>
            <input className={fieldInputClass} value={asunto} onChange={(e) => setAsunto(e.target.value)} required />
          </label>
        )}

        <label>
          <span className={fieldLabelClass}>Mensaje</span>
          <textarea
            ref={textareaRef}
            className={`${fieldInputClass} resize-y`}
            rows={12}
            value={cuerpo}
            onChange={(e) => setCuerpo(e.target.value)}
            required
          />
        </label>

        <div className="flex items-center flex-wrap gap-3">
          <button type="submit" disabled={guardando} className={btnPrimaryClass}>
            {guardando ? "Guardando…" : "Guardar"}
          </button>
          <button type="button" onClick={aplicarNegrita} className={btnSecondaryClass}>
            Negrita
          </button>
          <button
            type="button"
            onClick={aplicarLink}
            className={btnSecondaryClass}
            title={canal === "whatsapp" ? "Inserta la URL pelada — WhatsApp la previsualiza sola" : "Envuelve la selección como link real del mail"}
          >
            Link
          </button>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </form>
    </div>
  );
}
