"use client";

import { useEffect, useState } from "react";
import { ContactoUnificado, FiltroContactosState } from "@/data/crmUnificado";

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

  useEffect(() => {
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
  }, []);

  async function buscarLote(filtro: FiltroContactosState): Promise<ContactoUnificado[]> {
    const params = new URLSearchParams();
    if (filtro.categoria) params.set("categoria", filtro.categoria);
    if (filtro.rubros.length > 0) params.set("rubros", filtro.rubros.join(","));
    if (filtro.tier) params.set("tier", filtro.tier);
    if (filtro.activo) params.set("activo", filtro.activo);
    if (filtro.busqueda.trim()) params.set("busqueda", filtro.busqueda.trim());

    const res = await fetch(`/api/admin/crm/lote?${params.toString()}`);
    const data = await res.json();
    if (!Array.isArray(data)) {
      setError(data?.error ? `lote: ${data.error}` : "No se pudo traer el lote");
      return [];
    }
    return data;
  }

  return { opciones, error, buscarLote };
}
