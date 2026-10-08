import { NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";

export const dynamic = "force-dynamic";
export async function GET() {


  try {
    const conversations = await prisma.conversation.findMany({
      orderBy: {
        updatedAt: "desc",
      },
      include: {
        messages: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    return NextResponse.json(conversations);
  } catch (error) {
    console.error("❌ Error obteniendo conversaciones:", error);

    return NextResponse.json(
      { error: "No se pudieron obtener las conversaciones" },
      { status: 500 }
    );
  }
}