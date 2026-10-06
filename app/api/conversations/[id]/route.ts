import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const data: {
      mode?: "BOT" | "HUMAN";
      status?: "ACTIVE" | "NEEDS_ATTENTION" | "ATTENDED";
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    if (body.mode !== undefined) {
      if (body.mode !== "BOT" && body.mode !== "HUMAN") {
        return NextResponse.json(
          { error: "Modo inválido" },
          { status: 400 }
        );
      }

      data.mode = body.mode;
    }

    if (body.status !== undefined) {
      if (
        body.status !== "ACTIVE" &&
        body.status !== "NEEDS_ATTENTION" &&
        body.status !== "ATTENDED"
      ) {
        return NextResponse.json(
          { error: "Estado inválido" },
          { status: 400 }
        );
      }

      data.status = body.status;
    }

    if (body.mode === undefined && body.status === undefined) {
      return NextResponse.json(
        { error: "No se indicó ningún cambio" },
        { status: 400 }
      );
    }

    const conversation = await prisma.conversation.update({
      where: {
        id,
      },
      data,
    });

    return NextResponse.json(conversation);
  } catch (error) {
    console.error("❌ Error actualizando conversación:", error);

    return NextResponse.json(
      { error: "No se pudo actualizar la conversación" },
      { status: 500 }
    );
  }
}