import { describe, it, expect } from "vitest";
import {
  categoriaTrasInteraccion,
  CATEGORIA_PROSPECTO_CERO,
  CATEGORIA_PROSPECTO_INTERES,
  CATEGORIA_CLIENTE_ACTIVO,
  CATEGORIA_CLIENTE_VENCIDO,
} from "./crm";

describe("categoriaTrasInteraccion", () => {
  it("mueve un prospecto cero a interés", () => {
    expect(categoriaTrasInteraccion(CATEGORIA_PROSPECTO_CERO)).toBe(CATEGORIA_PROSPECTO_INTERES);
  });

  it("mantiene un prospecto en interés", () => {
    expect(categoriaTrasInteraccion(CATEGORIA_PROSPECTO_INTERES)).toBe(CATEGORIA_PROSPECTO_INTERES);
  });

  it("no retrocede a un cliente activo", () => {
    expect(categoriaTrasInteraccion(CATEGORIA_CLIENTE_ACTIVO)).toBe(CATEGORIA_CLIENTE_ACTIVO);
  });

  it("no retrocede a un cliente vencido", () => {
    expect(categoriaTrasInteraccion(CATEGORIA_CLIENTE_VENCIDO)).toBe(CATEGORIA_CLIENTE_VENCIDO);
  });
});
