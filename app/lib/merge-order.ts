import type { ParsedOrder } from "./parse-order";

export type PendingOrder = {
  conversation: string[];
  parsedOrder?: ParsedOrder;
};

export function mergeOrders(
  previous: PendingOrder | null,
  currentText: string
): PendingOrder {
  return {
    conversation: [
      ...(previous?.conversation ?? []),
      currentText,
    ],
    parsedOrder: previous?.parsedOrder,
  };
}

export function buildOrderContext(
  pendingOrder: PendingOrder | null,
  currentText: string
): string {
  const previousMessages = pendingOrder?.conversation ?? [];

  if (previousMessages.length === 0) {
    return currentText;
  }

  return `
CONTEXTO DE LA CONVERSACIÓN DEL PEDIDO:

${previousMessages
  .map((message, index) => `${index + 1}. Cliente: ${message}`)
  .join("\n")}

NUEVO MENSAJE DEL CLIENTE:
${currentText}

Interpreta el pedido completo utilizando el contexto anterior y el
nuevo mensaje.

No olvides productos que ya habían sido mencionados.

Si anteriormente había una aclaración pendiente, utiliza la nueva
respuesta para resolverla.

Si el cliente está modificando algo que ya había pedido, interpreta
la modificación sobre el pedido anterior.
`;
}