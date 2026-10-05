

import MessageCard from "./components/MessageCard";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <p className="text-sm text-green-400 font-medium">
            WhatsApp Mini Store
          </p>

          <h1 className="text-4xl font-bold mt-2">
            Panel de pedidos
          </h1>

          <p className="text-zinc-400 mt-2">
            Aquí veremos los mensajes y pedidos que lleguen desde WhatsApp.
          </p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <p className="text-zinc-400 text-sm">
              Mensajes recibidos
            </p>

            <p className="text-4xl font-bold mt-3">
              0
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

        <section className="mt-8 bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-xl font-semibold">
            Últimos mensajes
          </h2>

          <div className="mt-4">
  <MessageCard
    sender="Juan"
    message="Hola, quiero ver el menú"
    time="10:42 AM"
  />
</div>
        </section>
      </div>
    </main>
  );
}