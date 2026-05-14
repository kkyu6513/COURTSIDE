import Link from "next/link";

type Tab = {
  href: string;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
};

const STUDENT_TABS: Tab[] = [
  { href: "/", label: "홈", icon: <HomeIcon /> },
  { href: "/reschedule", label: "변경요청", icon: <BellIcon />, disabled: true },
  { href: "/chat", label: "메시지", icon: <ChatIcon />, disabled: true },
  { href: "/my", label: "마이", icon: <UserIcon />, disabled: true },
];

const COACH_TABS: Tab[] = [
  { href: "/", label: "스케줄", icon: <CalendarIcon /> },
  { href: "/chat", label: "메시지", icon: <ChatIcon />, disabled: true },
  { href: "/search", label: "회원 검색", icon: <SearchIcon />, disabled: true },
  { href: "/my", label: "마이", icon: <UserIcon />, disabled: true },
];

export function BottomNav({
  role,
  active,
}: {
  role: "STUDENT" | "COACH";
  active?: string;
}) {
  const tabs = role === "COACH" ? COACH_TABS : STUDENT_TABS;
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none"
      aria-label="하단 네비게이션"
    >
      <div className="max-w-md mx-auto px-4 pb-5 pointer-events-none">
        <div className="pointer-events-auto rounded-full bg-surface border border-line shadow-lg flex items-stretch h-14 overflow-hidden">
          {tabs.map((t) => {
            const isActive = (active ?? "/") === t.href;
            const className = `flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition ${
              isActive
                ? "text-emerald-500"
                : t.disabled
                  ? "text-ink-3"
                  : "text-ink-2"
            } ${t.disabled ? "cursor-not-allowed" : "hover:text-ink"}`;
            return t.disabled ? (
              <div key={t.href} className={className} aria-disabled>
                <span className="w-5 h-5">{t.icon}</span>
                <span>{t.label}</span>
              </div>
            ) : (
              <Link key={t.href} href={t.href} className={className}>
                <span className="w-5 h-5">{t.icon}</span>
                <span>{t.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
