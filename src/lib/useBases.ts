"use client";

import { useEffect, useState } from "react";
import { Base } from "@/data/bases";

// Lista de bases para poblar los <select> de CRM, Base Tracking, Envío de
// mails y WhatsApp, más el formulario de "Nuevo contacto" y el modal de
// "Crear nueva base" -- cada vista la pide de nuevo al montar (mismo patrón
// que useContactosUnificados), así que crear una base y volver a entrar a
// cualquier pantalla ya la muestra, sin invalidación manual.
export function useBases() {
  const [bases, setBases] = useState<Base[]>([]);
  const [error, setError] = useState<string | null>(null);

  function cargar() {
    fetch("/api/admin/bases")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setBases(data);
        } else {
          setBases([]);
          setError(data?.error ?? "No se pudieron cargar las bases");
        }
      });
  }

  useEffect(() => {
    cargar();
  }, []);

  return { bases, error, recargarBases: cargar };
}
