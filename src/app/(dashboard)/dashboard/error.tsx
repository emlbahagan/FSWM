"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-full min-h-[50vh] w-full items-center justify-center p-8">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
          <AlertCircle size={24} />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-foreground">
          Something went wrong!
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {error.message || "An unexpected error occurred while loading this page."}
        </p>
        <button
          onClick={() => reset()}
          className="mt-6 rounded-md bg-[var(--teal)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--teal)]/90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
