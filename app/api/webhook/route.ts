


import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";

const VERIFY_TOKEN = "mini_store_token";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new NextResponse(challenge);
  }

  return new NextResponse("Forbidden", {
    status: 403,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log("🔥 WEBHOOK REAL RECIBIDO");
    console.log("🕐 Hora:", new Date().toISOString());
    console.log("📦 Evento completo:");
    console.log(JSON.stringify(body, null, 2));

    const change = body?.entry?.[0]?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    console.log("📌 Tipo de evento:", change?.field);
    console.log("📱 Phone Number ID:", value?.metadata?.phone_number_id);
    console.log("👤 Remitente:", message?.from);
    console.log("💬 Mensaje:", message?.text?.body);

    // Si el evento no contiene un mensaje de texto, no hacemos nada.
    if (!message || message.type !== "text") {
      return NextResponse.json({ received: true });
    }

    const from = message.from;
    const text = message.text.body.trim().toLowerCase();

    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!accessToken || !phoneNumberId) {
      console.error("❌ Faltan variables de entorno de WhatsApp");

      return NextResponse.json(
        { error: "Missing WhatsApp environment variables" },
        { status: 500 }
      );
    }

    // Buscar o crear la conversación
    let conversation = await prisma.conversation.findUnique({
      where: {
        phone: from,
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          phone: from,
          status: "ACTIVE",
          mode: "BOT",
        },
      });
    }

    // Guardar mensaje del cliente
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        sender: "CUSTOMER",
        text: message.text.body,
      },
    });

    let reply = "";
    let status = conversation.status;
    let mode = conversation.mode;

    // Si la conversación está siendo atendida por una persona,
    // el bot no responde automáticamente.
    if (conversation.mode === "HUMAN") {
      console.log("👤 Conversación en modo humano. No se responde automáticamente.");

      return NextResponse.json({ received: true });
    }

    if (
      text === "hola" ||
      text === "holaa" ||
      text === "holaaa" ||
      text === "hello"
    ) {
      reply = `👋 ¡Hola! Bienvenido a Mini Store.

¿Qué quieres hacer?

1️⃣ Ver productos
2️⃣ Hacer un pedido
3️⃣ Hablar con alguien
4️⃣ Despedirme`;

      status = "ACTIVE";
      mode = "BOT";
    } else if (text === "1") {
      reply = `🛍️ Próximamente podrás ver nuestro catálogo de productos.

Escribe "Hola" para volver al menú.`;

      status = "ACTIVE";
      mode = "BOT";
    } else if (text === "2") {
      reply = `🛒 Perfecto. Próximamente podrás hacer tu pedido directamente desde aquí.

Escribe "Hola" para volver al menú.`;

      status = "ACTIVE";
      mode = "BOT";
    } else if (text === "3") {
      reply = `👤 Claro. Hemos recibido tu solicitud.

Una persona del equipo te atenderá en breve.`;

      status = "NEEDS_ATTENTION";
      mode = "HUMAN";
    } else if (
      text === "4" ||
      text === "adios" ||
      text === "adiós"
    ) {
      reply = "👋 ¡Listo! Hasta luego.";

      status = "ATTENDED";
      mode = "BOT";
    } else {
      reply = `🤔 No estoy seguro de qué quieres hacer.

Escribe "Hola" para ver el menú.`;

      status = "ACTIVE";
      mode = "BOT";
    }

    // Actualizar estado de la conversación
    await prisma.conversation.update({
      where: {
        id: conversation.id,
      },
      data: {
        status,
        mode,
      },
    });

    // Enviar respuesta por WhatsApp
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
          to: from,
          type: "text",
          text: {
            body: reply,
          },
        }),
      }
    );

    const responseData = await response.json();

    console.log("📤 Respuesta enviada a WhatsApp:");
    console.log(JSON.stringify(responseData, null, 2));

    if (!response.ok) {
      console.error("❌ Error enviando mensaje:", responseData);

      return NextResponse.json(
        { error: "Failed to send WhatsApp message" },
        { status: 500 }
      );
    }

    // Guardar respuesta del bot
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        sender: "BOT",
        text: reply,
      },
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("❌ Error procesando webhook:", error);

    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}