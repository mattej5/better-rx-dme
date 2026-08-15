export default async function VendorRunListPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  await params;

  return (
    <section>
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-soft">
        Desert Valley Hospice
      </p>
      <h1
        className="mt-1 text-[22px]"
        style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
      >
        Today&rsquo;s stops
      </h1>
      <p className="mt-1 text-[14px] text-ink-soft">No stops today.</p>
    </section>
  );
}
