"use client";

import { useEffect, useMemo, useState } from "react";
import { Contacto } from "@/data/crm";
import { LeadBase } from "@/data/leadsBase";
import { ContactoUnificado, unificarDesdeContactos, unificarDesdeTracking } from "@/data/crmUnificado";

// Fuente de datos compartida por CRM, Envío de mails y WhatsApp: hay una
// sola base de contactos, repartida en dos tablas de Supabase por motivos
// técnicos (`contactos` y `leads_base` -- ver migración 0005). Se traen las
// dos una sola vez y se combinan en `unificados`. Cada vista filtra sobre
// eso; cuando necesita el detalle completo de una fila (ej. abrir el panel
// de un contacto), busca por id en `contactos`/`tracking` según de qué
// tabla vino.
//
// Si cualquiera de las dos rutas falla (típicamente porque falta aplicar
// una migración en Supabase), se expone en `error` -- las vistas tienen que
// mostrarlo, nunca tratar un error como "no hay datos".
export function useContactosUnificados() {
  const [contactos, setContactos] = useState<Contacto[] | null>(null);
  const [tracking, setTracking] = useState<LeadBase[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/crm/contactos")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setContactos(data);
        } else {
          setContactos([]);
          setError(data?.error ? `contactos: ${data.error}` : "No se pudo cargar contactos");
        }
      });
    fetch("/api/admin/leads-base")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTracking(data);
        } else {
          setTracking([]);
          setError(data?.error ? `leads-base: ${data.error}` : "No se pudo cargar leads-base");
        }
      });
  }, []);

  const unificados = useMemo<ContactoUnificado[] | null>(() => {
    if (contactos === null || tracking === null) return null;
    return [...contactos.map(unificarDesdeContactos), ...tracking.map(unificarDesdeTracking)];
  }, [contactos, tracking]);

  const cargando = contactos === null || tracking === null;

  return { contactos, tracking, unificados, cargando, error };
}
