"use client";

import { useRouter } from "next/navigation";
import ErrorState from "@/components/error-state";

export default function RetryCard({ message }: { message?: string }) {
  const router = useRouter();
  return <ErrorState message={message} onRetry={() => router.refresh()} />;
}
