
import type { ParsedOrder } from "./parse-order";

export type PendingOrderItem = ParsedOrder["items"][number] & {
  name?: string;
  unitPrice?: number;
  subtotal?: number;
  productId?: string;
};

export type PendingOrder = {
  conversation: string[];
  parsedOrder?: ParsedOrder;
  items: PendingOrderItem[];
  total?: number;
};

export function mergeOrders(
  previous: PendingOrder | null,
  currentText: string,
  parsedOrder?: ParsedOrder
): PendingOrder {
  const previousItems =
    previous?.items ?? previous?.parsedOrder?.items ?? [];

  const currentItems = parsedOrder?.items ?? previousItems;

  return {
    conversation: [
      ...(previous?.conversation ?? []),
      currentText,
    ],
    parsedOrder: parsedOrder ?? previous?.parsedOrder,
    items: currentItems,
    total: previous?.total,
  };
}

export function buildOrderContext(
  pendingOrder: PendingOrder | null,
  currentText: string
): string {
  const previousMessages = pendingOrder?.conversation ?? [];

  const previousItems: PendingOrderItem[] =
  pendingOrder?.items ?? pendingOrder?.parsedOrder?.items ?? [];

  const orderSummary =
    previousItems.length > 0
      ? previousItems
          .map(
            (item) =>
              `- ${item.quantity} × ${item.name ?? item.slug}${
                item.notes ? ` (modificaciones: ${item.notes})` : ""
              }`
          )
          .join("\n")
      : "";

  if (previousMessages.length === 0 && !orderSummary) {
    return currentText;
  }

  return `
CONTEXTO DE LA CONVERSACIÓN DEL PEDIDO:

${orderSummary ? `PEDIDO ESTRUCTURADO ANTERIOR:\n${orderSummary}\n` : ""}

${previousMessages
  .map((message, index) => `${index + 1}. Cliente: ${message}`)
  .join("\n")}

NUEVO MENSAJE DEL CLIENTE:
${currentText}

INSTRUCCIONES:

- Conserva los productos y cantidades que el cliente ya pidió.
- Relaciona las modificaciones con el producto correspondiente.
- No cambies productos que el cliente no haya mencionado.
- Si el cliente responde una aclaración, resuelve únicamente
  la información pendiente.
- Si hace una pregunta informativa, no modifiques el pedido.
- No aceptes modificaciones imposibles ni inventes alternativas.
- No inventes productos, ingredientes, precios ni información
  del negocio.

Interpreta el mensaje nuevo según su intención y todo el contexto.
`;
}
