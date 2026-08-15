"use client";

import ErrorState from "@/components/error-state";

/** ErrorState's retry is a callback, and these pages are server components. */
export default function RetryCard({ message }: { message?: string }) {
  return (
    <ErrorState message={message} onRetry={() => window.location.reload()} />
  );
}
