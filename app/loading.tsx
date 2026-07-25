export default function Loading() {
  return (
    <main className="min-h-screen px-5 py-8 text-white">
      <div className="mx-auto max-w-7xl animate-pulse">
        <div className="h-24 rounded-2xl bg-white/10" />
        <div className="mt-8 h-14 rounded-xl bg-white/10" />
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, indice) => (
            <div
              key={indice}
              className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900"
            >
              <div className="aspect-square bg-white/10" />
              <div className="space-y-3 p-5">
                <div className="h-6 rounded bg-white/10" />
                <div className="h-4 w-2/3 rounded bg-white/10" />
                <div className="h-10 w-1/2 rounded bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
