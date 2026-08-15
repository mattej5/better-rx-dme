"use client";

import ErrorState from "@/components/error-state";

export default function RetryCard({ message }: { message?: string }) {
  return (
    <ErrorState message={message} onRetry={() => window.location.reload()} />
  );
}
