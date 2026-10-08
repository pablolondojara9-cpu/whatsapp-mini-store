import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { parseOrder } from "../../../lib/parse-order";
import { validateOrder } from "../../../lib/validate-order";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const text = body?.text;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        {
          error: "El campo 'text' es obligatorio.",
        },
        { status: 400 }
      );
    }

    const products = await prisma.product.findMany({
      where: {
        active: true,
      },
      select: {
        slug: true,
        name: true,
        price: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    const parsedOrder = await parseOrder(text, products);

    if (parsedOrder.needsClarification) {
      return NextResponse.json({
        success: true,
        type: "clarification",
        parsedOrder,
      });
    }

    if (parsedOrder.unrecognized.length > 0) {
      return NextResponse.json({
        success: true,
        type: "unrecognized",
        parsedOrder,
      });
    }

    const validatedOrder = await validateOrder(parsedOrder);

    return NextResponse.json({
      success: true,
      type: "order",
      parsedOrder,
      validatedOrder,
    });
    } catch (error) {
    console.error("❌ Error interpretando pedido:", error);

    const message =
      error instanceof Error
        ? error.message
        : "No se pudo interpretar el pedido.";

    return NextResponse.json({
      success: false,
      type: "validation_error",
      message,
    });
  }
}