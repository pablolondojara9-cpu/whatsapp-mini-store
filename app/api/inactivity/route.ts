import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";


const REMINDER_MINUTES = 10;
const CLOSE_MINUTES = 20;

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

  if (!response.ok) {
    console.error(
      "❌ Error enviando mensaje de inactividad:",
      responseData
    );

    throw new Error("Failed to send inactivity message");
  }

  return responseData;
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!accessToken || !phoneNumberId) {
      return NextResponse.json(
        { error: "Missing WhatsApp environment variables" },
        { status: 500 }
      );
    }

    const now = new Date();

    const conversations = await prisma.conversation.findMany({
      where: {
        mode: "BOT",
        status: "ACTIVE",
        lastCustomerMessageAt: {
          not: null,
        },
      },
    });

    let remindersSent = 0;
    let conversationsClosed = 0;

    for (const conversation of conversations) {
      if (!conversation.lastCustomerMessageAt) {
        continue;
      }

      const elapsedMinutes =
        (now.getTime() -
          conversation.lastCustomerMessageAt.getTime()) /
        1000 /
        60;

      // ─────────────────────────────────────────────
      // 10 MINUTOS → RECORDATORIO
      // ─────────────────────────────────────────────

      if (
        conversation.inactivityStage === "NONE" &&
        elapsedMinutes >= REMINDER_MINUTES &&
        elapsedMinutes < CLOSE_MINUTES
      ) {
        const reminderText =
          "👋 ¿Sigues ahí?\n\n" +
          "Si quieres continuar, simplemente escríbeme y seguimos.";

        await sendWhatsAppText({
          accessToken,
          phoneNumberId,
          to: conversation.phone,
          text: reminderText,
        });

        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            sender: "BOT",
            text: reminderText,
          },
        });

        await prisma.conversation.update({
          where: {
            id: conversation.id,
          },
          data: {
            inactivityStage: "REMINDER_SENT",
          },
        });

        remindersSent++;

        console.log(
          `⏰ Recordatorio enviado a ${conversation.phone}`
        );
      }

      // ─────────────────────────────────────────────
      // 20 MINUTOS → CERRAR
      // ─────────────────────────────────────────────

      if (
        conversation.inactivityStage === "REMINDER_SENT" &&
        elapsedMinutes >= CLOSE_MINUTES
      ) {
        await prisma.conversation.update({
          where: {
            id: conversation.id,
          },
          data: {
  status: "ATTENDED",
  step: "MENU",
  pendingOrder: { set: null },
  failedAttempts: 0,
  inactivityStage: "NONE",
},
        });

        conversationsClosed++;

        console.log(
          `🔒 Conversación cerrada por inactividad: ${conversation.phone}`
        );
      }
    }

    return NextResponse.json({
      success: true,
      remindersSent,
      conversationsClosed,
    });
  } catch (error) {
    console.error("❌ Error revisando inactividad:", error);

    return NextResponse.json(
      { error: "Inactivity check failed" },
      { status: 500 }
    );
  }
}