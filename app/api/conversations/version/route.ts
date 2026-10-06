import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const aggregate = await prisma.conversation.aggregate({
      _max: {
        updatedAt: true,
      },
      _count: true,
    });

    const version = `${aggregate._count}:${aggregate._max.updatedAt?.getTime() ?? 0}`;

    return NextResponse.json({ version });
  } catch (error) {
    console.error("❌ Error obteniendo versión de conversaciones:", error);

    return NextResponse.json(
      { error: "No se pudo obtener la versión de conversaciones" },
      { status: 500 }
    );
  }
}