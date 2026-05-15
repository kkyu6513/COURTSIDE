"use client";

import { useState, useTransition } from "react";
import { AlertModal } from "@/components/alert-modal";
import { acceptClaim, rejectClaim } from "./actions";

type AlertState = {
  open: boolean;
  variant: "success" | "warning" | "error" | "info";
  title: string;
  description?: string;
};

type Props = {
  claimId: number;
  studentName: string;
  studentPhone: string;
  createdAtLabel: string;
  requestedCoachName: string;
};

export function ClaimActionCard({
  claimId,
  studentName,
  studentPhone,
  createdAtLabel,
  requestedCoachName,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [actionType, setActionType] = useState<"accept" | "reject" | null>(null);
  const [confirm, setConfirm] = useState<"accept" | "reject" | null>(null);
  const [alert, setAlert] = useState<AlertState>({ open: false, variant: "info", title: "" });

  const close = () => setAlert((a) => ({ ...a, open: false }));

  const run = (type: "accept" | "reject") => {
    setActionType(type);
    setConfirm(null);
    startTransition(async () => {
      const fn = type === "accept" ? acceptClaim : rejectClaim;
      const res = await fn(claimId);
      if (!res.ok) {
        setAlert({
          open: true,
          variant: "error",
          title: "처리 중 오류가 발생했어요",
          description: res.error,
        });
        return;
      }
      setAlert({
        open: true,
        variant: "success",
        title: type === "accept" ? "학생 등록을 수락했어요" : "등록 요청을 거절했어요",
        description:
          type === "accept"
            ? "학생에게 결과가 전달돼요. (알림톡 발송은 곧 적용 예정)"
            : "학생에게 결과가 전달돼요. (알림톡 발송은 곧 적용 예정)",
      });
    });
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-ink">{studentName}</span>
            <span className="text-xs text-ink-3">학생</span>
          </div>
          <div className="mt-1 text-xs text-ink-2">{studentPhone}</div>
        </div>
        <div className="flex-none rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-600">
          처리 대기
        </div>
      </div>

      <div className="rounded-xl bg-soft p-3 text-xs text-ink-2 space-y-1">
        <p>
          학생이 입력한 코치 이름: <span className="font-semibold text-ink">{requestedCoachName}</span>
        </p>
        <p>신청 시각: {createdAtLabel}</p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setConfirm("reject")}
          disabled={pending}
          className="flex-1 h-11 rounded-xl border border-line bg-surface text-sm font-semibold text-ink-2 hover:bg-soft transition active:scale-[0.98] disabled:opacity-50"
        >
          {pending && actionType === "reject" ? "처리 중…" : "거절"}
        </button>
        <button
          type="button"
          onClick={() => setConfirm("accept")}
          disabled={pending}
          className="flex-1 h-11 rounded-xl bg-ink text-sm font-semibold text-white hover:opacity-90 transition active:scale-[0.98] disabled:opacity-50"
        >
          {pending && actionType === "accept" ? "처리 중…" : "수락"}
        </button>
      </div>

      <AlertModal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        variant={confirm === "accept" ? "info" : "warning"}
        title={confirm === "accept" ? "이 학생을 수락할까요?" : "이 요청을 거절할까요?"}
        description={
          confirm === "accept"
            ? `${studentName}님을 내 학생으로 등록합니다. 학생에게 수락 결과가 전달돼요.`
            : `${studentName}님의 등록 요청을 거절합니다. 학생에게 거절 결과가 전달돼요.`
        }
        confirmText="취소"
        primaryAction={{
          label: confirm === "accept" ? "수락" : "거절",
          onClick: () => confirm && run(confirm),
        }}
      />

      <AlertModal
        open={alert.open}
        onClose={close}
        variant={alert.variant}
        title={alert.title}
        description={alert.description}
      />
    </div>
  );
}
