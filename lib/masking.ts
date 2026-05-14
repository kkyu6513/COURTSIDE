/**
 * 개인정보 마스킹 유틸
 *
 * 적용 원칙:
 * - 본인은 풌 정보
 * - 본인-코치 직접 매칭된 관계(코치 ↔ 그 코치의 학생)도 풌
 * - 그 외(타 코치/타 사용자/일반 어드민 view)은 마스킹
 */

export function maskName(name: string | null | undefined): string {
  if (!name) return "";
  const trimmed = name.trim();
  if (trimmed.length === 0) return "";
  if (trimmed.length === 1) return "*";
  if (trimmed.length === 2) return trimmed[0] + "*";
  return trimmed[0] + "*".repeat(trimmed.length - 2) + trimmed[trimmed.length - 1];
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.length < 7) return digits;
  if (digits.length === 10) {
    // 010-XXX-XXXX (10자리, 2002년이전)
    return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
  }
  if (digits.length === 11) {
    // 010-XXXX-XXXX
    return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
  }
  return digits.slice(0, 3) + "-****-" + digits.slice(-4);
}

export function maskEmail(email: string | null | undefined): string {
  if (!email) return "";
  const [local, domain] = email.split("@");
  if (!domain) return email;
  if (local.length <= 2) return local[0] + "*".repeat(local.length - 1) + "@" + domain;
  return local.slice(0, 2) + "*".repeat(Math.max(local.length - 2, 3)) + "@" + domain;
}

export function maskBirthDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  // 생년월일은 년도만 노출, 월·일은 마스킹
  return `${yyyy}-**-**`;
}

export type ViewerRelation = "self" | "linkedCoach" | "other";

export function maskByRelation<T extends { realName?: string | null; phone?: string | null; email?: string | null; birthDate?: Date | string | null }>(
  user: T,
  relation: ViewerRelation,
): T {
  if (relation === "self" || relation === "linkedCoach") return user;
  return {
    ...user,
    realName: maskName(user.realName) as T["realName"],
    phone: maskPhone(user.phone) as T["phone"],
    email: maskEmail(user.email) as T["email"],
    birthDate: maskBirthDate(user.birthDate) as unknown as T["birthDate"],
  };
}
