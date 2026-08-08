import { describe, it, expect } from "vitest";
import { categoriaVisible } from "./crmUnificado";
import { CATEGORIA_PROSPECTO_CERO, CATEGORIA_CLIENTE_ACTIVO, CATEGORIA_CLIENTE_VENCIDO } from "./crm";

describe("categoriaVisible", () => {
  it("no toca prospecto_cero", () => {
    expect(categoriaVisible(CATEGORIA_PROSPECTO_CERO, null, "2026-08-08")).toBe(CATEGORIA_PROSPECTO_CERO);
  });

  it("cliente_activo con vigencia futura sigue activo", () => {
    expect(categoriaVisible(CATEGORIA_CLIENTE_ACTIVO, "2027-01-01", "2026-08-08")).toBe(CATEGORIA_CLIENTE_ACTIVO);
  });

  it("cliente_activo con vigencia vencida se muestra vencido", () => {
    expect(categoriaVisible(CATEGORIA_CLIENTE_ACTIVO, "2026-01-01", "2026-08-08")).toBe(CATEGORIA_CLIENTE_VENCIDO);
  });

  it("cliente_activo sin vigencia cargada nunca vence", () => {
    expect(categoriaVisible(CATEGORIA_CLIENTE_ACTIVO, null, "2026-08-08")).toBe(CATEGORIA_CLIENTE_ACTIVO);
  });
});
