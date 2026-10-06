import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const text = body.text?.trim();

    if (!text) {
      return NextResponse.json(
        { error: "El mensaje no puede estar vacío" },
        { status: 400 }
      );
    }

    const conversation = await prisma.conversation.findUnique({
      where: {
        id,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversación no encontrada" },
        { status: 404 }
      );
    }

    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const testEnv = process.env.TEST_ENV;

console.log("🔎 DEBUG ENV:", {
  hasAccessToken: !!accessToken,
  tokenLength: accessToken?.length,
  phoneNumberId,
  testEnv,
});

    if (!accessToken || !phoneNumberId) {
      console.error("❌ Faltan variables de entorno de WhatsApp");

      return NextResponse.json(
        { error: "Faltan variables de entorno de WhatsApp" },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://graph.facebook.com/v26.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: conversation.phone,
          type: "text",
          text: {
            body: text,
          },
        }),
      }
    );

    const responseData = await response.json();

    console.log("📤 Mensaje enviado desde el panel:");
    console.log(JSON.stringify(responseData, null, 2));

    if (!response.ok) {
      console.error("❌ Error enviando mensaje:", responseData);

      return NextResponse.json(
        {
          error: "No se pudo enviar el mensaje por WhatsApp",
          details: responseData,
        },
        { status: 500 }
      );
    }

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        sender: "HUMAN",
        text,
      },
    });

    await prisma.conversation.update({
      where: {
        id: conversation.id,
      },
      data: {
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(message);
  } catch (error) {
    console.error("❌ Error enviando mensaje desde el panel:", error);

    return NextResponse.json(
      { error: "No se pudo enviar el mensaje" },
      { status: 500 }
    );
  }
}