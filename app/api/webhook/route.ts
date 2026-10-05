//ROUTE

import { NextRequest, NextResponse } from "next/server";

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
  const body = await request.json();

  console.log("🔥🔥🔥 WEBHOOK REAL RECIBIDO 🔥🔥🔥");
  console.log("🕐 Hora:", new Date().toISOString());
  console.log("📡 Método: POST");
  console.log("📦 Evento completo:");
  console.log(JSON.stringify(body, null, 2));

  const change = body?.entry?.[0]?.changes?.[0];
  const value = change?.value;
  const message = value?.messages?.[0];

  console.log("📌 Tipo de evento:", change?.field);
  console.log("📱 Phone Number ID:", value?.metadata?.phone_number_id);
  console.log("👤 Remitente:", message?.from);
  console.log("💬 Mensaje:", message?.text?.body);

  return NextResponse.json({
    received: true,
  });
}