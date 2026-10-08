import "dotenv/config";
import { prisma } from "./app/lib/prisma";

async function main() {
  const conversation = await prisma.conversation.findFirst({
    orderBy: {
      updatedAt: "desc",
    },
  });

  if (!conversation) {
    throw new Error("No hay conversaciones.");
  }

  console.log("Conversación encontrada:", conversation.phone);

  await prisma.conversation.update({
    where: {
      id: conversation.id,
    },
    data: {
      lastCustomerMessageAt: new Date(Date.now() - 11 * 60 * 1000),
      inactivityStage: "NONE",
      status: "ACTIVE",
      mode: "BOT",
      step: "WAITING_ORDER",
    },
  });

  console.log("✅ Conversación preparada para prueba de recordatorio.");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });