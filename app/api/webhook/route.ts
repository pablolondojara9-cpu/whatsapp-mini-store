import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";

const VERIFY_TOKEN = "mini_store_token";

const CATALOG_URL =
  "https://whatsapp-mini-store-ashen.vercel.app/catalogo-la-esquina.pdf";

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

async function sendWhatsAppText({
  accessToken,
  phoneNumberId,
  to,
  text,
}: {
  accessToken: string;
  phoneNumberId: string;
  to: string;
  text: string;
}) {
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
        to,
        type: "text",
        text: {
          body: text,
        },
      }),
    }
  );

  const responseData = await response.json();

  console.log("📤 Mensaje de texto enviado:");
  console.log(JSON.stringify(responseData, null, 2));

  if (!response.ok) {
    console.error("❌ Error enviando mensaje de texto:", responseData);
    throw new Error("Failed to send WhatsApp text");
  }

  return responseData;
}

async function sendWhatsAppDocument({
  accessToken,
  phoneNumberId,
  to,
  documentUrl,
}: {
  accessToken: string;
  phoneNumberId: string;
  to: string;
  documentUrl: string;
}) {
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
        to,
        type: "document",
        document: {
          link: documentUrl,
          filename: "Catalogo-La-Esquina.pdf",
          caption: "📖 Catálogo de La Esquina",
        },
      }),
    }
  );

  const responseData = await response.json();

  console.log("📄 Catálogo enviado:");
  console.log(JSON.stringify(responseData, null, 2));

  if (!response.ok) {
    console.error("❌ Error enviando catálogo:", responseData);
    throw new Error("Failed to send WhatsApp document");
  }

  return responseData;
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

    // Solo procesamos mensajes de texto.
    if (!message || message.type !== "text") {
      return NextResponse.json({ received: true });
    }

    const from = message.from;
    const originalText = message.text.body.trim();
    const text = originalText.toLowerCase();

    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!accessToken || !phoneNumberId) {
      console.error("❌ Faltan variables de entorno de WhatsApp");

      return NextResponse.json(
        { error: "Missing WhatsApp environment variables" },
        { status: 500 }
      );
    }

    // Buscar o crear conversación
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
        text: originalText,
      },
    });

    // Actualizar actividad
    conversation = await prisma.conversation.update({
      where: {
        id: conversation.id,
      },
      data: {
        updatedAt: new Date(),
      },
    });

    // Si está en modo humano, el bot no responde.
    if (conversation.mode === "HUMAN") {
      console.log(
        "👤 Conversación en modo humano. No se responde automáticamente."
      );

      return NextResponse.json({ received: true });
    }

    /*
     * ---------------------------------------------------------
     * Detectamos cuál fue el último mensaje enviado por el bot.
     *
     * Esto nos permite distinguir:
     *
     * 1 → Ver productos
     *
     * de:
     *
     * 1 → Hacer pedido
     * ---------------------------------------------------------
     */

    const lastBotMessage = await prisma.message.findFirst({
      where: {
        conversationId: conversation.id,
        sender: "BOT",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    let reply = "";
    let status = conversation.status;
    let mode = conversation.mode;

    /*
     * =========================================================
     * MENÚ PRINCIPAL
     * =========================================================
     */

    if (
      text === "hola" ||
      text === "holaa" ||
      text === "holaaa" ||
      text === "hello"
    ) {
      reply = `👋 ¡Hola! Bienvenido a La Esquina.

¿Qué quieres hacer?

1️⃣ Ver productos
2️⃣ Hacer un pedido
3️⃣ Hablar con alguien
4️⃣ Despedirme`;

      status = "ACTIVE";
      mode = "BOT";
    }

    /*
     * =========================================================
     * OPCIÓN 1
     *
     * Si el último mensaje del bot era el menú del catálogo,
     * significa "Hacer pedido".
     *
     * Si no, significa "Ver productos".
     * =========================================================
     */

    else if (text === "1") {
      const isOrderingFromCatalog =
        lastBotMessage?.text.includes(
          "Ya puedes revisar nuestro catálogo"
        );

      if (isOrderingFromCatalog) {
        reply = `🛒 Perfecto.

Escríbeme los productos que quieres y, si quieres, indica las cantidades.

Por ejemplo:

"2 hamburguesas, 1 perro caliente y una Coca-Cola"

También puedes escribir simplemente los nombres de los productos.`;

        status = "ACTIVE";
        mode = "BOT";
      } else {
        status = "ACTIVE";
        mode = "BOT";

        /*
         * Primero enviamos el PDF.
         */
        await sendWhatsAppDocument({
          accessToken,
          phoneNumberId,
          to: from,
          documentUrl: CATALOG_URL,
        });

        /*
         * Guardamos una representación del documento
         * en el historial.
         */
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            sender: "BOT",
            text: "📖 Catálogo de La Esquina enviado.",
          },
        });

        /*
         * Esperamos aproximadamente 1 segundo antes
         * de enviar el siguiente mensaje.
         */
        await new Promise((resolve) => setTimeout(resolve, 1000));

        reply = `🛍️ Ya puedes revisar nuestro catálogo.

1️⃣ Hacer pedido
2️⃣ Volver al menú`;
      }
    }

    /*
     * =========================================================
     * OPCIÓN 2
     * =========================================================
     */

    else if (text === "2") {
      /*
       * Si el usuario está en el menú del catálogo,
       * vuelve al menú principal.
       *
       * Si está en el menú principal, empieza el pedido.
       */
      const isCatalogMenu =
        lastBotMessage?.text.includes(
          "Ya puedes revisar nuestro catálogo"
        );

      if (isCatalogMenu) {
        reply = `👋 Volviendo al menú.

¿Qué quieres hacer?

1️⃣ Ver productos
2️⃣ Hacer un pedido
3️⃣ Hablar con alguien
4️⃣ Despedirme`;

        status = "ACTIVE";
        mode = "BOT";
      } else {
        reply = `🛒 Perfecto.

Escríbeme los productos que quieres y, si quieres, indica las cantidades.

Por ejemplo:

"2 hamburguesas, 1 perro caliente y una Coca-Cola"

También puedes escribir simplemente los nombres de los productos.`;

        status = "ACTIVE";
        mode = "BOT";
      }
    }

    /*
     * =========================================================
     * HABLAR CON ALGUIEN
     * =========================================================
     */

    else if (text === "3") {
      reply = `👤 Claro. Hemos recibido tu solicitud.

Una persona del equipo te atenderá en breve.`;

      status = "NEEDS_ATTENTION";
      mode = "HUMAN";
    }

    /*
     * =========================================================
     * DESPEDIRSE
     * =========================================================
     */

    else if (
      text === "4" ||
      text === "adios" ||
      text === "adiós"
    ) {
      reply = "👋 ¡Listo! Hasta luego.";

      status = "ATTENDED";
      mode = "BOT";
    }

    /*
     * =========================================================
     * OTROS MENSAJES
     * =========================================================
     */

    else {
      reply = `🤔 No estoy seguro de qué quieres hacer.

Escribe "Hola" para ver el menú.`;

      status = "ACTIVE";
      mode = "BOT";
    }

    /*
     * Actualizar estado y actividad.
     */
    conversation = await prisma.conversation.update({
      where: {
        id: conversation.id,
      },
      data: {
        status,
        mode,
        updatedAt: new Date(),
      },
    });

    /*
     * =========================================================
     * ENVIAR RESPUESTA DE TEXTO
     * =========================================================
     */

    if (reply) {
      await sendWhatsAppText({
        accessToken,
        phoneNumberId,
        to: from,
        text: reply,
      });

      /*
       * Guardar respuesta del bot.
       */
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          sender: "BOT",
          text: reply,
        },
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("❌ Error procesando webhook:", error);

    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}