import Link from "next/link";
export type MobileSection = "play" | "rewards" | "history" | "profile";
export function MobileNav({ current }: { current: MobileSection }) {
  return (
    <nav className="passenger-nav" aria-label="Your passenger pages">
      {[
        ["play", "/mobile", "▶", "Play"],
        ["rewards", "/mobile/rewards", "★", "My winnings"],
        ["history", "/mobile/history", "↺", "History"],
        ["profile", "/mobile/profile", "◉", "Profile"],
      ].map(([id, href, icon, label]) => (
        <Link
          key={id}
          href={href}
          aria-current={current === id ? "page" : undefined}
        >
          <span aria-hidden>{icon}</span>
          {label}
        </Link>
      ))}
    </nav>
  );
}
