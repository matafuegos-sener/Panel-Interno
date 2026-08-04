"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";

export default function AdminLoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Contraseña incorrecta");
        return;
      }
      router.refresh();
    } catch {
      setError("No se pudo verificar la contraseña. Intentá de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-xl px-6 py-8 flex flex-col gap-4"
    >
      <div className="flex flex-col items-center gap-2 mb-2">
        <div className="w-12 h-12 rounded-full bg-[var(--color-brand-red-subtle)] flex items-center justify-center">
          <Lock className="w-5 h-5 text-[var(--color-brand-red)]" />
        </div>
        <h1 className="text-lg font-bold text-[var(--color-brand-dark)]">Panel interno</h1>
        <p className="text-sm text-[var(--color-text-muted)] text-center">
          Matafuegos Sener · Captación de clientes
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="admin-password" className="type-label text-[var(--color-text-muted)]">
          Contraseña
        </label>
        <input
          id="admin-password"
          type="password"
          autoFocus
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(""); }}
          className={`w-full border rounded-lg px-3 py-2.5 text-sm text-[var(--color-brand-dark)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-red)] focus:border-transparent ${error ? "border-red-400 bg-red-50" : "border-[var(--color-border)]"}`}
        />
      </div>

      {error && <p className="text-xs text-red-600 text-center">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting || !password}
        className="w-full text-center bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-dark)] text-white font-semibold px-4 py-3 rounded-lg text-sm transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isSubmitting ? "Verificando…" : "Ingresar"}
      </button>
    </form>
  );
}
