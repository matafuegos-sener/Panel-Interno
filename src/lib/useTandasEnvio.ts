"use client";

import { useEffect, useState } from "react";
import { TandaEnvio } from "@/data/tandas";

// Poll simple de las tandas de envío (mail/WhatsApp) -- no hay nada tipo
// websocket en este panel, así que "en vivo" acá significa refetch cada
// pocos segundos mientras el componente esté montado.
export function useTandasEnvio(intervaloMs = 5000) {
  const [tandas, setTandas] = useState<TandaEnvio[] | null>(null);

  useEffect(() => {
    let activo = true;

    async function cargar() {
      const res = await fetch("/api/admin/envios", { cache: "no-store" });
      const data = await res.json();
      if (activo && Array.isArray(data)) setTandas(data);
    }

    cargar();
    const id = setInterval(cargar, intervaloMs);
    return () => {
      activo = false;
      clearInterval(id);
    };
  }, [intervaloMs]);

  return tandas;
}
