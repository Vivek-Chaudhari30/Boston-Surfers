import Link from "next/link";

export function ArcadeBrand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="arcade-brand" aria-label="Boston Surfers home">
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path
          d="M5 11 23 3l20 8-3 26-17 9L7 36Z"
          fill="#ffdc53"
          stroke="#101631"
          strokeWidth="3"
        />
        <path
          d="m13 15 24-3-7 10 9 1-20 16 5-14-12 2Z"
          fill="#ff608d"
          stroke="#101631"
          strokeWidth="2"
        />
        <path
          d="m24 10-5 13 9-1-5 13 14-16-9 1 7-10Z"
          fill="#efffff"
          stroke="#101631"
          strokeWidth="2"
        />
      </svg>
      <span>
        Boston
        <br />
        <em>Surfers</em>
      </span>
    </Link>
  );
}
