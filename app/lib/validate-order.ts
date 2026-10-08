import { prisma } from "./prisma";
import type { ParsedOrder } from "./parse-order";

export type ValidatedOrderItem = {
  productId: string;
  slug: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes: string | null;
};

export type ValidatedOrder = {
  items: ValidatedOrderItem[];
  total: number;
};

export async function validateOrder(
  parsedOrder: ParsedOrder
): Promise<ValidatedOrder> {
  if (parsedOrder.needsClarification) {
    throw new Error(
      parsedOrder.clarificationQuestion ||
        "Necesitamos aclarar el pedido."
    );
  }

  if (parsedOrder.items.length === 0) {
    throw new Error("No se encontraron productos en el pedido.");
  }

  if (parsedOrder.unrecognized.length > 0) {
    throw new Error(
      `Productos no reconocidos: ${parsedOrder.unrecognized.join(", ")}`
    );
  }

  const slugs = parsedOrder.items.map((item) => item.slug);

  const products = await prisma.product.findMany({
    where: {
      slug: {
        in: slugs,
      },
      active: true,
    },
  });

  const productMap = new Map(
    products.map((product) => [product.slug, product])
  );

  const items: ValidatedOrderItem[] = [];

  for (const item of parsedOrder.items) {
    const product = productMap.get(item.slug);

    if (!product) {
      throw new Error(
        `El producto "${item.slug}" no existe o no está disponible.`
      );
    }

    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error(
        `Cantidad inválida para "${product.name}".`
      );
    }

    if (product.stock < item.quantity) {
  throw new Error(
    `No hay suficiente stock de ${product.name}. Solo quedan ${product.stock} unidades.`
  );
}

    const subtotal = product.price * item.quantity;

    items.push({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      quantity: item.quantity,
      unitPrice: product.price,
      subtotal,
      notes: item.notes,
    });
  }

  const total = items.reduce(
    (sum, item) => sum + item.subtotal,
    0
  );

  return {
    items,
    total,
  };
}