import type { ParsedOrder } from "./parse-order";

export type BusinessRuleResult = {
  valid: boolean;
  message: string | null;
};

export function validateBusinessRules(
  parsedOrder: ParsedOrder,
  originalText: string
): BusinessRuleResult {
  const text = originalText.toLowerCase().trim();

  /*
   * =====================================================
   * REGLAS DE MODIFICACIONES IMPOSIBLES
   * =====================================================
   */

  // Hamburguesa sin nada
  if (
    text.includes("sin nada") ||
    text.includes("sin todo") ||
    text.includes("sin ingredientes") ||
    text.includes("sin absolutamente nada") ||
    text.includes("quítale todo") ||
    text.includes("quitale todo")
  ) {
    if (
      text.includes("hamburguesa") ||
      parsedOrder.items.some((item) =>
        item.slug.includes("hamburguesa")
      )
    ) {
      return {
        valid: false,
        message:
          "🤔 Una hamburguesa no se puede pedir sin ningún ingrediente.\n\nSi quieres quitar algún ingrediente, dime cuál.",
      };
    }
  }

  // Hamburguesa sin pan
  if (
    (text.includes("hamburguesa") ||
      parsedOrder.items.some((item) =>
        item.slug.includes("hamburguesa")
      )) &&
    text.includes("sin pan")
  ) {
    return {
      valid: false,
      message:
        "🤔 No es posible venderte una hamburguesa sin pan.\n\nSi quieres modificar algún ingrediente, dime cuál.",
    };
  }

  // Gaseosa sin gas
  if (
    (text.includes("gaseosa") ||
      text.includes("coca cola") ||
      text.includes("coca-cola") ||
      text.includes("sprite")) &&
    text.includes("sin gas")
  ) {
    return {
      valid: false,
      message:
        "🤔 No es posible vender una gaseosa sin gas, ya que estas bebidas vienen selladas y preparadas de fábrica.\n\nSi quieres una gaseosa, puedes elegir una de las disponibles en el catálogo.",
    };
  }

  /*
   * =====================================================
   * TODO CORRECTO
   * =====================================================
   */

  return {
    valid: true,
    message: null,
  };
}