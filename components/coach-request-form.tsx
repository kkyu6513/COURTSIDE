"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Field, TextInput } from "@/components/onboarding-form";
import { AlertModal } from "@/components/alert-modal";
import { requestCoachLink } from "@/app/actions/request-coach-link";

type AlertState = {
  open: boolean;
  variant: "warning" | "error" | "success" | "info";
  title: string;
  description?: string;
};

export function CoachRequestForm() {
  const router = useRouter();
  const [coachName, setCoachName] = useState("");
  const [coachPhone, setCoachPhone] = useState("");
  const [pending, startTransition] = useTransition();
  const [alert, setAlert] = useState<AlertState>({
    open: false,
    variant: "info",
    title: "",
  });

  const close = () => setAlert((a) => ({ ...a, open: false }));

  const handleSubmit = () => {
    if (!coachName.trim()) {
      setAlert({ open: true, variant: "warning", title: "코치 이름을 입력해 주세요" });
      return;
    }
    if (coachPhone.length < 10 || coachPhone.length > 11) {
      setAlert({
        open: true,
        variant: "warning",
        title: "코치 전화번호를 확인해 주세요",
        description: "10~11자리 숫자(- 없이)로 입력해 주세요.",
      });
      return;
    }

    const fd = new FormData();
    fd.set("coachName", coachName.trim());
    fd.set("coachPhone", coachPhone);

    startTransition(async () => {
      const res = await requestCoachLink(fd);
      if (!res.ok) {
        setAlert({ open: true, variant: "error", title: "신청 중 오류", description: res.error });
        return;
      }
      if (res.matched) {
        setAlert({
          open: true,
          variant: "success",
          title: "신청 완료",
          description: res.notified
            ? "코치님께 알림이 발송되었어요. 코치님이 회원님을 등록하면 자동 연결됩니다."
            : "신청이 접수되었어요. 코치님께 알림 발송은 잠시 후 처리됩니다.",
        });
      } else {
        setAlert({
          open: true,
          variant: "warning",
          title: "코치를 찾지 못했어요",
          description:
            "입력하신 번호로 가입한 코치를 찾을 수 없습니다. 코치님께 가입하셨는지 확인 부탁드리고, 다시 시도해 주세요.",
        });
      }
      router.refresh();
    });
  };

  return (
    <>
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
        <div className="text-sm font-bold text-ink">🎾 코치 등록 요청</div>
        <p className="mt-1 text-xs text-ink-2 leading-relaxed">
          레슨받으시는 코치님 정보를 입력하시면 알림이 발송돼요. 코치님이 회원님을 등록하면 자동 연결됩니다.
        </p>

        <div className="mt-3 space-y-3">
          <Field label="코치 이름" required>
            <TextInput
              type="text"
              value={coachName}
              onChange={(e) => setCoachName(e.target.value)}
              placeholder="예: 김코치"
              maxLength={30}
              disabled={pending}
            />
          </Field>

          <Field label="코치 전화번호" required>
            <TextInput
              type="tel"
              inputMode="numeric"
              value={coachPhone}
              onChange={(e) => setCoachPhone(e.target.value.replace(/[^\d]/g, "").slice(0, 11))}
              placeholder="01012345678 (- 없이)"
              pattern="[0-9]{10,11}"
              maxLength={11}
              disabled={pending}
            />
          </Field>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending}
            className="w-full h-11 rounded-xl bg-ink text-white text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed hover:opacity-90 transition active:scale-[0.98] inline-flex items-center justify-center gap-2"
          >
            {pending && (
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4zm2 5.3A7.96 7.96 0 014 12H0c0 3 1.1 5.8 3 7.9l3-2.6z" />
              </svg>
            )}
            {pending ? "신청 중…" : "코치에게 알림 보내기"}
          </button>
        </div>
      </div>

      <AlertModal open={alert.open} onClose={close} title={alert.title} description={alert.description} variant={alert.variant} />
    </>
  );
}

export function CoachRequestPending({
  coachName,
  notifiedAt,
}: {
  coachName: string;
  notifiedAt: string | null;
}) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-none">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-ink">
            <b>{coachName}</b> 코치님께 신청을 보냈어요
          </div>
          <p className="mt-1 text-xs text-ink-2 leading-relaxed">
            {notifiedAt
              ? "알림이 발송되었어요. 코치님이 회원님을 학생으로 등록하면 자동 연결됩니다."
              : "잠시 후 코치님께 알림이 발송됩니다."}
          </p>
        </div>
      </div>
    </div>
  );
}
