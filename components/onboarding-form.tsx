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
      className="w-full h-12 rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-3"
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

export function SubmitButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="w-full h-12 rounded-xl bg-ink text-white font-semibold text-sm hover:opacity-90 transition active:scale-[0.98]"
    >
      {children}
    </button>
  );
}
