import Link from "next/link";

const MOMENTS: { num: string; title: string; body: string }[] = [
  {
    num: "01",
    title: "Discharge readiness",
    body: "Order at intake and see the delivery window before the patient moves.",
  },
  {
    num: "02",
    title: "Post-death pickup",
    body: "Pickup starts from the record, not from a phone call the next morning.",
  },
  {
    num: "03",
    title: "Service failure",
    body: "An order at risk shows the reason next to the flag, in plain words.",
  },
];

const TAGS = ["Sample data", "Demo build", "Not a production system"];

function SignInButton({ large = false }: { large?: boolean }) {
  return (
    <Link
      href="/signin"
      className={
        large
          ? "inline-flex min-h-[52px] items-center justify-center px-8 text-[16px]"
          : "inline-flex min-h-[44px] items-center justify-center px-5 text-[13px]"
      }
      style={{
        background: "var(--salmon)",
        color: "var(--ink)",
        borderRadius: "var(--radius-btn)",
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      Sign in
    </Link>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--line)] bg-surface">
        <div className="mx-auto flex max-w-[430px] items-center justify-between px-5 py-3 md:max-w-[900px]">
          <span
            className="text-[16px]"
            style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
          >
            BetterRX DME
          </span>
          <SignInButton />
        </div>
      </header>

      <main className="mx-auto max-w-[430px] px-5 md:max-w-[900px]">
        <section className="pb-12 pt-14 md:pt-20">
          <span className="eyebrow">Hospice equipment</span>
          <h1
            className="text-[clamp(30px,7vw,48px)] leading-[1.12]"
            style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
          >
            DME ordering and visibility for hospice teams
          </h1>
          <p className="mt-5 max-w-[620px] text-[17px] leading-[1.6] text-ink-soft">
            Two moments sit outside the hospice EMR. Equipment that arrives late
            for a discharge, and equipment still in a family&rsquo;s home after a
            death.
          </p>
          <p className="mt-3 max-w-[620px] text-[17px] leading-[1.6] text-ink-soft">
            This is one place to place the order, watch it move, and close it
            out.
          </p>

          <div className="mt-8">
            <SignInButton large />
          </div>
        </section>

        <section
          className="rounded-[10px] px-6 py-8 md:px-9"
          style={{ background: "var(--taupe)" }}
        >
          <div className="grid gap-7 md:grid-cols-3 md:gap-8">
            {MOMENTS.map((moment) => (
              <div key={moment.num}>
                <span
                  className="block text-[22px] leading-none"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    color: "var(--burnt-dark)",
                  }}
                >
                  {moment.num}
                </span>
                <h2
                  className="mt-3 text-[17px] leading-tight"
                  style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
                >
                  {moment.title}
                </h2>
                <p className="mt-1.5 text-[14.5px] leading-[1.55] text-ink">
                  {moment.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="quote-card my-12">
          <p>
            The hospice takes the call about the bed that never showed up, and
            the call about the bed nobody came back for.
          </p>
          <span className="quote-cite">The coordination gap</span>
        </section>
      </main>

      <footer className="border-t border-[var(--line)]">
        <div className="mx-auto flex max-w-[430px] flex-wrap items-center gap-2 px-5 py-7 md:max-w-[900px]">
          {TAGS.map((tag) => (
            <span
              key={tag}
              className="badge"
              style={{ background: "var(--paper-alt)", color: "var(--ink-soft)" }}
            >
              {tag}
            </span>
          ))}
        </div>
      </footer>
    </div>
  );
}
