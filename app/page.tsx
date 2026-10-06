"use client";

import { useEffect, useState } from "react";

type ConversationStatus =
  | "needs_attention"
  | "active"
  | "attended";

type MessageSender = "bot" | "customer" | "human";

type ConversationMessage = {
  id: string;
  sender: MessageSender;
  text: string;
  createdAt: string;
};

type Conversation = {
  id: string;
  phone: string;
  name: string | null;
  status: ConversationStatus;
  mode: "bot" | "human";
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
};

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

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString("es-CO", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadConversations() {
      try {
        setLoading(true);

        const response = await fetch("/api/conversations");

        if (!response.ok) {
          throw new Error("No se pudieron cargar las conversaciones");
        }

        const data = await response.json();

        const normalized: Conversation[] = data.map(
          (conversation: {
            id: string;
            phone: string;
            name: string | null;
            status: string;
            mode: string;
            createdAt: string;
            updatedAt: string;
            messages: {
              id: string;
              sender: string;
              text: string;
              createdAt: string;
            }[];
          }) => ({
            ...conversation,
            status:
              conversation.status === "NEEDS_ATTENTION"
                ? "needs_attention"
                : conversation.status === "ATTENDED"
                  ? "attended"
                  : "active",
            mode:
              conversation.mode === "HUMAN"
                ? "human"
                : "bot",
            messages: conversation.messages.map((message) => ({
              ...message,
              sender:
                message.sender === "CUSTOMER"
                  ? "customer"
                  : message.sender === "HUMAN"
                    ? "human"
                    : "bot",
            })),
          })
        );

        setConversations(normalized);
        setError("");
      } catch (error) {
        console.error(error);
        setError("No se pudieron cargar las conversaciones.");
      } finally {
        setLoading(false);
      }
    }

    loadConversations();
  }, []);

  const selectedConversation = conversations.find(
    (conversation) => conversation.id === selectedId
  );

  const pendingConversations = conversations.filter(
    (conversation) => conversation.status === "needs_attention"
  );

  function selectConversation(id: string) {
    setSelectedId(id);
  }

  function closeConversation() {
    setSelectedId(null);
  }

  function markAsAttended() {
    if (!selectedConversation) return;

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
  }

  function sendMessage() {
    if (!messageInput.trim() || !selectedConversation) return;

    console.log(
      "Mensaje preparado para enviar:",
      messageInput.trim()
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
              {conversations.reduce(
                (total, conversation) =>
                  total + conversation.messages.length,
                0
              )}
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
            {loading && (
              <div className="p-6 text-sm text-zinc-500">
                Cargando conversaciones...
              </div>
            )}

            {!loading && error && (
              <div className="p-6 text-sm text-red-400">
                {error}
              </div>
            )}

            {!loading &&
              !error &&
              conversations.length === 0 && (
                <div className="p-6 text-sm text-zinc-500">
                  Todavía no hay conversaciones.
                </div>
              )}

            {!loading &&
              !error &&
              conversations.map((conversation) => {
                const lastMessage =
                  conversation.messages[
                    conversation.messages.length - 1
                  ];

                const displayName =
                  conversation.name || conversation.phone;

                return (
                  <button
                    key={conversation.id}
                    onClick={() =>
                      selectConversation(conversation.id)
                    }
                    className="w-full text-left px-6 py-5 border-b border-zinc-800 last:border-b-0 hover:bg-zinc-800/50 transition"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center font-semibold">
                        {displayName.charAt(0)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-4">
                          <p className="font-semibold">
                            {displayName}
                          </p>

                          <span className="text-xs text-zinc-500">
                            {formatTime(conversation.updatedAt)}
                          </span>
                        </div>

                        <p className="text-xs text-zinc-600 mt-1">
                          {conversation.phone}
                        </p>

                        <p className="text-sm text-zinc-400 mt-1 truncate">
                          {lastMessage?.text || "Sin mensajes"}
                        </p>

                        <div className="mt-2">
                          <StatusIndicator
                            status={conversation.status}
                          />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
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
                    {selectedConversation.name ||
                      selectedConversation.phone}
                  </p>

                  <p className="text-xs text-zinc-600 mt-1">
                    {selectedConversation.phone}
                  </p>

                  <div className="mt-1">
                    <StatusIndicator
                      status={selectedConversation.status}
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={markAsAttended}
                className="text-xs px-3 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition"
              >
                Marcar como atendida
              </button>
            </div>

            <div className="p-6 space-y-4 min-h-[300px]">
              {selectedConversation.messages.map(
                (message) => (
                  <div
                    key={message.id}
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