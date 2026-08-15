/**
 * Desktop break-out for the DON's two dashboard screens. The shell keeps its
 * 430px phone column for every other route; this wrapper re-centers its child
 * on the viewport at lg and up. Phone rendering is untouched.
 */
export default function WideColumn({ children }: { children: React.ReactNode }) {
  return (
    <div className="lg:relative lg:left-1/2 lg:w-[min(1080px,calc(100vw-40px))] lg:-translate-x-1/2">
      {children}
    </div>
  );
}
