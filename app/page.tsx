"use client";

import { useState } from "react";

type ConversationStatus = "needs_attention" | "active" | "attended";

type Conversation = {
  id: number;
  name: string;
  message: string;
  time: string;
  status: ConversationStatus;
  messages: {
    sender: "bot" | "customer";
    text: string;
  }[];
};

const initialConversations: Conversation[] = [
  {
    id: 1,
    name: "Juan",
    message: "Quiero hablar con alguien",
    time: "10:42 AM",
    status: "needs_attention",
    messages: [
      {
        sender: "bot",
        text: "👋 ¡Hola! Bienvenido a Mini Store.",
      },
      {
        sender: "customer",
        text: "Quiero hablar con alguien",
      },
      {
        sender: "bot",
        text: "Claro. Te comunico con una persona del equipo.",
      },
    ],
  },
  {
    id: 2,
    name: "Carlos",
    message: "¿Qué productos tienen?",
    time: "10:38 AM",
    status: "active",
    messages: [
      {
        sender: "customer",
        text: "¿Qué productos tienen?",
      },
    ],
  },
  {
    id: 3,
    name: "Pedro",
    message: "Gracias, eso era todo",
    time: "10:31 AM",
    status: "attended",
    messages: [
      {
        sender: "customer",
        text: "Gracias, eso era todo",
      },
    ],
  },
];

function StatusIndicator({
  status,
}: {
  status: ConversationStatus;
}) {
  if (status === "needs_attention") {
    return (
      <span className="inline-flex items-center gap-2 text-orange-400 text-xs font-medium">
        <span className="h-2.5 w-2.5 rounded-full bg-orange-400" />
        Necesita atención
      </span>
    );
  }

  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-2 text-green-400 text-xs font-medium">
        <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
        Conversación activa
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 text-zinc-400 text-xs font-medium">
      <span className="h-2.5 w-2.5 rounded-full bg-zinc-500" />
      Atendida
    </span>
  );
}

export default function Home() {
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messageInput, setMessageInput] = useState("");

  const selectedConversation = conversations.find(
    (conversation) => conversation.id === selectedId
  );

  const pendingConversations = conversations.filter(
    (conversation) => conversation.status === "needs_attention"
  );

  function selectConversation(id: number) {
    setSelectedId(id);
  }

  function closeConversation() {
    setSelectedId(null);
  }

  function sendMessage() {
    if (!messageInput.trim() || !selectedConversation) return;

    const newMessage = messageInput.trim();

    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === selectedConversation.id
          ? {
              ...conversation,
              status: "active",
              message: newMessage,
              messages: [
                ...conversation.messages,
                {
                  sender: "bot",
                  text: newMessage,
                },
              ],
            }
          : conversation
      )
    );

    setMessageInput("");
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* HEADER */}
        <header className="mb-8 flex items-start justify-between gap-6">
          <div>
            <p className="text-sm text-green-400 font-medium">
              WhatsApp Mini Store
            </p>

            <h1 className="text-4xl font-bold mt-2">
              Panel de pedidos
            </h1>

            <p className="text-zinc-400 mt-2">
              Aquí veremos los mensajes y pedidos que lleguen desde WhatsApp.
            </p>
          </div>

          {/* NOTIFICACIÓN */}
          {pendingConversations.length > 0 && (
            <button
              onClick={() =>
                setSelectedId(pendingConversations[0].id)
              }
              className="group relative flex items-center gap-3 rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 transition hover:bg-orange-500/15"
            >
              <span className="absolute inset-0 rounded-2xl bg-orange-400/10 animate-ping" />

              <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/15 text-orange-400">
                🔔
              </span>

              <span className="relative text-left">
                <span className="block text-sm font-semibold text-white">
                  Solicitudes de atención
                </span>

                <span className="block text-xs text-orange-300 mt-0.5">
                  {pendingConversations.length} pendiente
                  {pendingConversations.length !== 1 ? "s" : ""}
                </span>
              </span>

              <span className="relative flex h-6 min-w-6 items-center justify-center rounded-full bg-orange-500 px-2 text-xs font-bold text-white">
                {pendingConversations.length}
              </span>
            </button>
          )}
        </header>

        {/* INDICADORES */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <p className="text-zinc-400 text-sm">
              Mensajes recibidos
            </p>

            <p className="text-4xl font-bold mt-3">
              {conversations.length}
            </p>
          </div>

          <div
            className={`bg-zinc-900 border rounded-2xl p-6 ${
              pendingConversations.length > 0
                ? "border-orange-500/30"
                : "border-zinc-800"
            }`}
          >
            <p className="text-zinc-400 text-sm">
              Por responder
            </p>

            <p
              className={`text-4xl font-bold mt-3 ${
                pendingConversations.length > 0
                  ? "text-orange-400"
                  : "text-white"
              }`}
            >
              {pendingConversations.length}
            </p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <p className="text-zinc-400 text-sm">
              Pedidos
            </p>

            <p className="text-4xl font-bold mt-3">
              0
            </p>
          </div>
        </section>

        {/* MENSAJES */}
        <section className="mt-8 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-zinc-800">
            <h2 className="text-xl font-semibold">
              Mensajes
            </h2>

            <p className="text-sm text-zinc-500 mt-1">
              Conversaciones recibidas desde WhatsApp
            </p>
          </div>

          <div>
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => selectConversation(conversation.id)}
                className="w-full text-left px-6 py-5 border-b border-zinc-800 last:border-b-0 hover:bg-zinc-800/50 transition"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center font-semibold">
                    {conversation.name.charAt(0)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-semibold">
                        {conversation.name}
                      </p>

                      <span className="text-xs text-zinc-500">
                        {conversation.time}
                      </span>
                    </div>

                    <p className="text-sm text-zinc-400 mt-1 truncate">
                      {conversation.message}
                    </p>

                    <div className="mt-2">
                      <StatusIndicator
                        status={conversation.status}
                      />
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* CONVERSACIÓN */}
        {selectedConversation && (
          <section className="mt-8 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={closeConversation}
                  className="text-zinc-400 hover:text-white transition"
                >
                  ←
                </button>

                <div>
                  <p className="font-semibold">
                    {selectedConversation.name}
                  </p>

                  <StatusIndicator
                    status={selectedConversation.status}
                  />
                </div>
              </div>

              <button
                onClick={() => {
                  setConversations((current) =>
                    current.map((conversation) =>
                      conversation.id === selectedConversation.id
                        ? {
                            ...conversation,
                            status: "attended",
                          }
                        : conversation
                    )
                  );
                }}
                className="text-xs px-3 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition"
              >
                Marcar como atendida
              </button>
            </div>

            <div className="p-6 space-y-4 min-h-[300px]">
              {selectedConversation.messages.map(
                (message, index) => (
                  <div
                    key={index}
                    className={`flex ${
                      message.sender === "customer"
                        ? "justify-start"
                        : "justify-end"
                    }`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${
                        message.sender === "customer"
                          ? "bg-zinc-800 text-zinc-200"
                          : "bg-green-600 text-white"
                      }`}
                    >
                      {message.text}
                    </div>
                  </div>
                )
              )}
            </div>

            <div className="border-t border-zinc-800 p-4 flex gap-3">
              <input
                value={messageInput}
                onChange={(event) =>
                  setMessageInput(event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    sendMessage();
                  }
                }}
                placeholder="Escribe un mensaje..."
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-500"
              />

              <button
                onClick={sendMessage}
                className="px-5 rounded-xl bg-green-600 hover:bg-green-500 transition font-medium"
              >
                Enviar
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}