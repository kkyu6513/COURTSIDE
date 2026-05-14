"use client";

import { useFormStatus } from "react-dom";
import { FormPendingIndicator } from "@/components/form-pending-indicator";

export function SubmitButton({
  children,
  pendingText = "처리 중…",
}: {
  children: React.ReactNode;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <>
      <FormPendingIndicator />
      <button
        type="submit"
        disabled={pending}
        className="w-full h-12 rounded-xl bg-ink text-white font-semibold text-sm hover:opacity-90 transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
      >
        {pending && (
          <svg
            className="animate-spin h-4 w-4 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4zm2 5.3A7.96 7.96 0 014 12H0c0 3 1.1 5.8 3 7.9l3-2.6z"
            />
          </svg>
        )}
        {pending ? pendingText : children}
      </button>
    </>
  );
}
