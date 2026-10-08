import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";
import { parseOrder } from "../../lib/parse-order";
import { validateOrder } from "../../lib/validate-order";
import {
  ConversationMode,
  ConversationStatus,
  ConversationStep,
} from "../../generated/prisma/client";
import {
  buildOrderContext,
  mergeOrders,
  type PendingOrder,
} from "../../lib/merge-order";

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
          step: "MENU",
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

    console.log("🧭 Estado actual de conversación:", conversation.step);

    // Si está en modo humano, el bot no responde.
    if (conversation.mode === "HUMAN") {
      console.log(
        "👤 Conversación en modo humano. No se responde automáticamente."
      );

      return NextResponse.json({ received: true });
    }

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

    let status: ConversationStatus = conversation.status;
    let mode: ConversationMode = conversation.mode;
    let step: ConversationStep = conversation.step;

    /*
     * =========================================================
     * PEDIDO
     *
     * IMPORTANTE:
     * Esta comprobación va ANTES del menú.
     *
     * Si estamos esperando un pedido, cualquier texto del cliente
     * pasa directamente a DeepSeek.
     * =========================================================
     */

    if (conversation.step === "WAITING_ORDER") {
  try {
    console.log("🧠 Interpretando pedido con DeepSeek...");
    console.log("📝 Texto recibido:", originalText);

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

    const pendingOrder = conversation.pendingOrder
      ? (conversation.pendingOrder as PendingOrder)
      : null;

    const context = buildOrderContext(
      pendingOrder,
      originalText
    );

    console.log("🧠 Contexto enviado a DeepSeek:");
    console.log(context);

    const parsedOrder = await parseOrder(
      context,
      products
    );

    console.log("🧠 Pedido interpretado:");
    console.log(JSON.stringify(parsedOrder, null, 2));

    /*
     * =====================================================
     * ACLARACIÓN
     * =====================================================
     */

    if (parsedOrder.needsClarification) {
      const newPendingOrder = mergeOrders(
        pendingOrder,
        originalText
      );

      await prisma.conversation.update({
        where: {
          id: conversation.id,
        },
        data: {
          pendingOrder: newPendingOrder,
          failedAttempts: 0,
          status: "ACTIVE",
          mode: "BOT",
          step: "WAITING_ORDER",
          updatedAt: new Date(),
        },
      });

      reply =
        parsedOrder.clarificationQuestion ||
        "🤔 Necesito un poco más de información para completar tu pedido.";

      status = "ACTIVE";
      mode = "BOT";
      step = "WAITING_ORDER";
    }

    /*
     * =====================================================
     * PRODUCTO NO RECONOCIDO
     * =====================================================
     */

    else if (parsedOrder.unrecognized.length > 0) {
      const nextFailedAttempts =
        conversation.failedAttempts + 1;

      if (nextFailedAttempts >= 4) {
        reply = `🤝 Parece que estamos teniendo problemas para entender tu pedido.

Si quieres, puedo pasarte con una persona del equipo para que te ayude.

1️⃣ Hablar con una persona
2️⃣ Intentar nuevamente`;

        status = "NEEDS_ATTENTION";
        mode = "HUMAN";
        step = "WAITING_ORDER";

        await prisma.conversation.update({
          where: {
            id: conversation.id,
          },
          data: {
            failedAttempts: nextFailedAttempts,
            status,
            mode,
            step,
            updatedAt: new Date(),
          },
        });
      } else {
        const newPendingOrder = mergeOrders(
          pendingOrder,
          originalText
        );

        reply = `🤔 No estoy seguro de qué quieres decir.

¿Podrías revisar tu pedido y escribírmelo de nuevo?`;

        status = "ACTIVE";
        mode = "BOT";
        step = "WAITING_ORDER";

        await prisma.conversation.update({
          where: {
            id: conversation.id,
          },
          data: {
            pendingOrder: newPendingOrder,
            failedAttempts: nextFailedAttempts,
            status,
            mode,
            step,
            updatedAt: new Date(),
          },
        });
      }
    }

    /*
     * =====================================================
     * PEDIDO COMPLETO
     * =====================================================
     */

    else {
      const validatedOrder = await validateOrder(
        parsedOrder
      );

      const lines = validatedOrder.items.map((item) => {
        const base =
          `${item.quantity} × ${item.name} — $${item.subtotal.toLocaleString("es-CO")}`;

        if (!item.notes) {
          return base;
        }

        return `${base}\n   📝 ${item.notes}`;
      });

      reply = `🛒 Revisa tu pedido

${lines.join("\n")}

Total: $${validatedOrder.total.toLocaleString("es-CO")}

¿Está correcto?

1️⃣ Confirmar pedido
2️⃣ Modificar pedido
3️⃣ Cancelar`;

      status = "ACTIVE";
      mode = "BOT";
      step = "REVIEWING_ORDER";

      await prisma.conversation.update({
        where: {
          id: conversation.id,
        },
        data: {
          pendingOrder: parsedOrder,
          failedAttempts: 0,
          status,
          mode,
          step,
          updatedAt: new Date(),
        },
      });
    }
  } catch (error) {
    console.error(
      "❌ Error interpretando pedido desde WhatsApp:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "No pude procesar tu pedido.";

    reply = `❌ ${message}

Puedes intentar nuevamente escribiendo tu pedido.`;

    status = "ACTIVE";
    mode = "BOT";
    step = "WAITING_ORDER";
  }
}

    /*
     * =========================================================
     * MENÚ PRINCIPAL
     * =========================================================
     */

    else if (
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
      step = "MENU";
    }

    /*
     * =========================================================
     * OPCIÓN 1
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
        step = "WAITING_ORDER";
      } else {
        status = "ACTIVE";
        mode = "BOT";
        step = "CATALOG";

        await sendWhatsAppDocument({
          accessToken,
          phoneNumberId,
          to: from,
          documentUrl: CATALOG_URL,
        });

        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            sender: "BOT",
            text: "📖 Catálogo de La Esquina enviado.",
          },
        });

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
        step = "MENU";
      } else {
        reply = `🛒 Perfecto.

Escríbeme los productos que quieres y, si quieres, indica las cantidades.

Por ejemplo:

"2 hamburguesas, 1 perro caliente y una Coca-Cola"

También puedes escribir simplemente los nombres de los productos.`;

        status = "ACTIVE";
        mode = "BOT";
        step = "WAITING_ORDER";
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
      step = "MENU";
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
      step = "MENU";
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
      step = "MENU";
    }

    /*
     * =========================================================
     * ACTUALIZAR CONVERSACIÓN
     * =========================================================
     */

    conversation = await prisma.conversation.update({
      where: {
        id: conversation.id,
      },
      data: {
        status,
        mode,
        step,
        updatedAt: new Date(),
      },
    });

    /*
     * =========================================================
     * ENVIAR RESPUESTA
     * =========================================================
     */

    if (reply) {
      await sendWhatsAppText({
        accessToken,
        phoneNumberId,
        to: from,
        text: reply,
      });

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