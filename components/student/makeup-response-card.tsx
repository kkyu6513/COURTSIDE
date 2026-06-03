"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertModal } from "@/components/alert-modal";
import { acceptMakeup, rejectMakeup } from "@/app/actions/lessons";

/**
 * MAKEUP_PENDING 보강 제안에 대한 학생 수락/거절 액션 버튼.
 * StudentResponseRequired 의 카드 하단에 부착해 사용.
 */
export function MakeupResponseActions({ lessonId }: { lessonId: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState<"accept" | "reject" | null>(null);
  const [confirm, setConfirm] = useState<"reject" | null>(null);
  const [alert, setAlert] = useState<{
    open: boolean;
    variant: "error" | "warning" | "success";
    title: string;
    description?: string;
  }>({ open: false, variant: "error", title: "" });

  const run = (kind: "accept" | "reject") => {
    setRunning(kind);
    startTransition(async () => {
      const fn = kind === "accept" ? acceptMakeup : rejectMakeup;
      const res = await fn(lessonId);
      setRunning(null);
      if (!res.ok) {
        setAlert({
          open: true,
          variant: kind === "accept" ? "error" : "warning",
          title: kind === "accept" ? "보강 수락 실패" : "보강 거절 실패",
          description: res.error,
        });
        return;
      }
      router.refresh();
    });
  };

  const isPending = pending && running !== null;

  return (
    <>
      <div className="px-4 pt-2 pb-3 flex gap-2">
        <button
          type="button"
          onClick={() => setConfirm("reject")}
          disabled={isPending}
          className="flex-1 h-10 rounded-lg border border-line bg-surface text-sm font-semibold text-ink-2 hover:bg-soft transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {running === "reject" && pending ? "처리 중…" : "거절"}
        </button>
        <button
          type="button"
          onClick={() => run("accept")}
          disabled={isPending}
          className="flex-1 h-10 rounded-lg bg-primary text-white text-sm font-semibold hover:opacity-90 transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {running === "accept" && pending ? "수락 중…" : "수락"}
        </button>
      </div>

      <AlertModal
        open={confirm === "reject"}
        onClose={() => setConfirm(null)}
        variant="warning"
        title="보강 제안을 거절할까요?"
        description="거절하면 코치님께 새 일정 제안을 요청할 수 있어요."
        confirmText="닫기"
        primaryAction={{
          label: running === "reject" && pending ? "처리 중…" : "거절",
          onClick: () => {
            setConfirm(null);
            run("reject");
          },
        }}
      />

      <AlertModal
        open={alert.open}
        onClose={() => setAlert((a) => ({ ...a, open: false }))}
        variant={alert.variant}
        title={alert.title}
        description={alert.description}
      />
    </>
  );
}
