
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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
        text: { body: text },
      }),
    }
  );

  const responseData = await response.json();

  if (!response.ok) {
    console.error("Error enviando mensaje de inactividad:", responseData);
    throw new Error("Failed to send inactivity message");
  }

  return responseData;
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  // La ruta no funciona si no está configurada la clave secreta.
  if (!cronSecret) {
    console.error("Falta configurar CRON_SECRET");
    return NextResponse.json(
      { error: "Cron authentication is not configured" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!accessToken || !phoneNumberId) {
      return NextResponse.json(
        { error: "Missing WhatsApp environment variables" },
        { status: 500 }
      );
    }

    const now = new Date();
    const reminderCutoff = new Date(
      now.getTime() - REMINDER_MINUTES * 60_000
    );
    const closeCutoff = new Date(
      now.getTime() - CLOSE_MINUTES * 60_000
    );

    const conversations = await prisma.conversation.findMany({
      where: {
        mode: "BOT",
        status: "ACTIVE",
        lastCustomerMessageAt: { lte: reminderCutoff },
      },
    });

    let remindersSent = 0;
    let conversationsClosed = 0;
    let errors = 0;

    for (const conversation of conversations) {
      const lastMessageAt = conversation.lastCustomerMessageAt;

      if (!lastMessageAt) continue;

      const elapsedMinutes =
        (now.getTime() - lastMessageAt.getTime()) / 60_000;

      // 10 minutos: reclamar el recordatorio de forma atómica.
      if (
        conversation.inactivityStage === "NONE" &&
        elapsedMinutes >= REMINDER_MINUTES &&
        elapsedMinutes < CLOSE_MINUTES
      ) {
        const claim = await prisma.conversation.updateMany({
          where: {
            id: conversation.id,
            mode: "BOT",
            status: "ACTIVE",
            inactivityStage: "NONE",
            lastCustomerMessageAt: lastMessageAt,
          },
          data: {
            inactivityStage: "REMINDER_SENT",
          },
        });

        if (claim.count !== 1) continue;

        const reminderText =
          "👋 ¿Sigues ahí?\n\n" +
          "Si quieres continuar, escríbeme y seguimos.";

        try {
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

          remindersSent++;
        } catch (error) {
          // Si falló el envío, permitir un nuevo intento,
          // pero solo si el cliente no ha escrito entretanto.
          await prisma.conversation.updateMany({
            where: {
              id: conversation.id,
              inactivityStage: "REMINDER_SENT",
              lastCustomerMessageAt: lastMessageAt,
            },
            data: {
              inactivityStage: "NONE",
            },
          });

          errors++;
          console.error(
            `Error con el recordatorio de ${conversation.phone}:`,
            error
          );
        }

        continue;
      }

      // 20 minutos: volver a comprobar la hora y el estado
      // antes de cambiar la conversación.
      if (
        conversation.inactivityStage === "REMINDER_SENT" &&
        elapsedMinutes >= CLOSE_MINUTES
      ) {
        const close = await prisma.conversation.updateMany({
          where: {
            id: conversation.id,
            mode: "BOT",
            status: "ACTIVE",
            inactivityStage: "REMINDER_SENT",
            lastCustomerMessageAt: {
              lte: closeCutoff,
              equals: lastMessageAt,
            },
          },
          data: {
            status: "ATTENDED",
            step: "MENU",
            failedAttempts: 0,
            invalidRequestAttempts: 0,
            inactivityStage: "NONE",
          },
        });

        if (close.count === 1) {
          conversationsClosed++;
          console.log(
            `Conversación finalizada por inactividad: ${conversation.phone}`
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      remindersSent,
      conversationsClosed,
      errors,
    });
  } catch (error) {
    console.error("Error revisando inactividad:", error);

    return NextResponse.json(
      { error: "Inactivity check failed" },
      { status: 500 }
    );
  }
}
