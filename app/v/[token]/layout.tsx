export default function VendorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto min-h-screen max-w-[430px] px-5 py-6">{children}</div>
  );
}
