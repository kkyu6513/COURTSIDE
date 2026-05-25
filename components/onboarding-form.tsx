import Link from "next/link";

export const SIDO_LIST = [
  "서울특별시",
  "부산광역시",
  "대구광역시",
  "인천광역시",
  "광주광역시",
  "대전광역시",
  "울산광역시",
  "세종특별자치시",
  "경기도",
  "강원특별자치도",
  "충청북도",
  "충청남도",
  "전북특별자치도",
  "전라남도",
  "경상북도",
  "경상남도",
  "제주특별자치도",
];

export function OnboardingHeader({
  backHref,
  step,
  total,
}: {
  backHref?: string;
  step: number;
  total: number;
}) {
  return (
    <div className="flex items-center h-12 -mx-2">
      {backHref ? (
        <Link
          href={backHref}
          aria-label="뒤로가기"
          className="w-10 h-10 flex items-center justify-center text-ink hover:bg-soft rounded-full transition"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
      ) : (
        <div className="w-10 h-10" />
      )}
      <div className="flex-1 text-center text-xs text-ink-3">
        {step} / {total}
      </div>
      <div className="w-10 h-10" />
    </div>
  );
}

export function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-sm font-semibold text-ink mb-2 flex items-center gap-1">
        {label}
        {required && <span className="text-red-500">*</span>}
      </div>
      {children}
    </div>
  );
}

export function RadioGroup({
  name,
  options,
  required = true,
  cols = 3,
}: {
  name: string;
  options: { value: string; label: string }[];
  required?: boolean;
  cols?: 2 | 3 | 5;
}) {
  const colsClass =
    cols === 2 ? "grid-cols-2" : cols === 5 ? "grid-cols-5" : "grid-cols-3";
  return (
    <div className={`grid ${colsClass} gap-2`}>
      {options.map((o) => (
        <label key={o.value} className="cursor-pointer">
          <input
            type="radio"
            name={name}
            value={o.value}
            required={required}
            className="peer sr-only"
          />
          <div className="h-11 flex items-center justify-center rounded-lg border border-line bg-surface text-sm text-ink-2 peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white transition">
            {o.label}
          </div>
        </label>
      ))}
    </div>
  );
}

export function Select({
  name,
  required,
  placeholder,
  options,
}: {
  name: string;
  required?: boolean;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      name={name}
      required={required}
      defaultValue=""
      className="w-full h-12 rounded-lg border border-line bg-surface px-3 text-sm text-ink"
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full h-12 rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-3 disabled:bg-soft disabled:text-ink-3 disabled:cursor-not-allowed"
    />
  );
}

export function Textarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  return (
    <textarea
      {...props}
      className="w-full rounded-lg border border-line bg-surface p-3 text-sm text-ink placeholder:text-ink-3 resize-none"
    />
  );
}

// SubmitButton은 useFormStatus 사용을 위해 별도 파일로 분리:
// import { SubmitButton } from "@/components/submit-button";
