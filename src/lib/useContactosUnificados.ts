"use client";

import { useEffect, useState } from "react";
import { AtajoCrm, ContactoUnificado, FiltroContactosState } from "@/data/crmUnificado";

export interface OpcionesFiltro {
  categorias: string[];
  rubros: string[];
  tiers: string[];
}

// Fuente de datos compartida por CRM, Envío de mails y WhatsApp: hay una
// sola base de contactos, repartida en dos tablas de Supabase por motivos
// técnicos (`contactos` y `leads_base` -- ver migración 0005). En vez de
// bajar las dos tablas completas al montar (9.500+ filas, contradice "no
// navegues la base entera"), acá solo se trae al montar la lista de
// opciones para los <select> (liviana, /api/admin/crm/opciones) y se expone
// `buscarLote` para que cada vista pida al servidor, ya filtrado, el lote
// que necesita cuando el usuario aprieta "Filtrar".
export function useContactosUnificados() {
  const [opciones, setOpciones] = useState<OpcionesFiltro | null>(null);
  const [error, setError] = useState<string | null>(null);

  function cargarOpciones() {
    fetch("/api/admin/crm/opciones")
      .then((r) => r.json())
      .then((data) => {
        if (data?.rubros) {
          setOpciones(data);
        } else {
          setOpciones({ categorias: [], rubros: [], tiers: [] });
          setError(data?.error ? `opciones: ${data.error}` : "No se pudieron cargar las opciones de filtro");
        }
      });
  }

  // Se piden una sola vez al montar -- si se da de alta un contacto con un
  // rubro nuevo (ver PanelNuevoContacto en CrmView.tsx), hay que volver a
  // llamar `recargarOpciones` a mano en ese punto, si no el rubro nuevo no
  // aparece en el filtro hasta recargar la página entera.
  useEffect(() => {
    cargarOpciones();
  }, []);

  async function buscarLote(filtro: FiltroContactosState): Promise<ContactoUnificado[]> {
    const params = new URLSearchParams();
    if (filtro.categoria) params.set("categoria", filtro.categoria);
    if (filtro.estadoCrm) params.set("estado_crm", filtro.estadoCrm);
    if (filtro.rubros.length > 0) params.set("rubros", filtro.rubros.join(","));
    if (filtro.tier) params.set("tier", filtro.tier);
    if (filtro.activo) params.set("activo", filtro.activo);
    if (filtro.mailEnviado) params.set("mail_enviado", filtro.mailEnviado);
    if (filtro.whatsappEnviado) params.set("whatsapp_enviado", filtro.whatsappEnviado);
    if (filtro.llamadaRealizada) params.set("llamada_realizada", filtro.llamadaRealizada);
    if (filtro.busqueda.trim()) params.set("busqueda", filtro.busqueda.trim());
    if (filtro.baseId) params.set("base_id", filtro.baseId);

    const res = await fetch(`/api/admin/crm/lote?${params.toString()}`);
    const data = await res.json();
    if (!Array.isArray(data)) {
      setError(data?.error ? `lote: ${data.error}` : "No se pudo traer el lote");
      return [];
    }
    return data;
  }

  async function buscarAtajo(atajo: AtajoCrm): Promise<ContactoUnificado[]> {
    const res = await fetch(`/api/admin/crm/lote?atajo=${atajo}`);
    const data = await res.json();
    if (!Array.isArray(data)) {
      setError(data?.error ? `lote: ${data.error}` : "No se pudo traer el lote");
      return [];
    }
    return data;
  }

  return { opciones, error, buscarLote, buscarAtajo, recargarOpciones: cargarOpciones };
}
