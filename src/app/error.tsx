"use client";

import { RouteErrorState } from "@/components/boundaries/RouteErrorState";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteErrorState error={error} reset={reset} scope="root" />;
}
