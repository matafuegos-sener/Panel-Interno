"use client";

import { useEffect, useState } from "react";

export interface CampanaMail {
  id: string;
  estado: "activa" | "completada" | "cancelada";
  asunto: string;
  cuerpo: string;
  creado_en: string;
  ultima_corrida_en: string | null;
  total_enviados: number;
}

// Misma campaña que administra EnviosMailView.tsx (POST/DELETE) -- este hook
// solo la lee, para poder mostrar su estado también en Envíos activos (donde
// se nota si el cupo diario ya está gastado, pero antes no se veía por qué).
export function useCampanaMail() {
  const [campana, setCampana] = useState<CampanaMail | null>(null);
  const [cargando, setCargando] = useState(true);

  function recargar() {
    setCargando(true);
    fetch("/api/admin/mail/campana")
      .then((r) => r.json())
      .then((data) => setCampana(data?.campana ?? null))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    recargar();
  }, []);

  return { campana, cargando, recargar };
}
