"use client";

import { useFormStatus } from "react-dom";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

/**
 * Server Action 폼 전송 중 상단에 진행 바를 띄우는 컴포넌트.
 * 반드시 <form action={...}> 내부에 배치해야 합니다.
 * useFormStatus는 form의 자식 컴포넌트에서만 동작합니다.
 */
export function FormPendingIndicator() {
  const { pending } = useFormStatus();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!pending || !mounted) return null;

  return createPortal(
    <div className="courtside-progress-bar" aria-hidden />,
    document.body,
  );
}
