"use client";

import { useEffect, useState } from "react";

export interface CampanaMail {
  id: string;
  estado: "activa" | "pausada" | "completada" | "cancelada";
  asunto: string;
  cuerpo: string;
  creado_en: string;
  ultima_corrida_en: string | null;
  total_enviados: number;
}

export interface CupoHoy {
  tope: number;
  yaEnviadosHoy: number;
  restante: number;
}

// Misma campaña que administra EnviosMailView.tsx (POST) -- este hook la lee
// (activa o pausada) junto con el cupo diario de hoy, para poder mostrarla
// como una fila más en Envíos activos, con pausar/reanudar/frenar/eliminar.
export function useCampanaMail() {
  const [campana, setCampana] = useState<CampanaMail | null>(null);
  const [cupoHoy, setCupoHoy] = useState<CupoHoy | null>(null);
  const [cargando, setCargando] = useState(true);

  function recargar() {
    setCargando(true);
    fetch("/api/admin/mail/campana")
      .then((r) => r.json())
      .then((data) => {
        setCampana(data?.campana ?? null);
        setCupoHoy(data?.cupoHoy ?? null);
      })
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    recargar();
  }, []);

  return { campana, cupoHoy, cargando, recargar };
}
