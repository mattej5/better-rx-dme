export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6">
      <h1
        className="text-4xl font-bold"
        style={{ fontFamily: "var(--font-display)", color: "var(--salmon)" }}
      >
        BetterRX DME
      </h1>
      <p style={{ color: "var(--ink-soft)" }}>
        Build in progress — Desert Valley demo
      </p>
    </main>
  );
}
