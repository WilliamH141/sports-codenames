type Props = {
  /** Number of connected viewers who haven't taken a seat. */
  count: number;
};

/** Viewer count for people watching without a seat. Spectators are otherwise
    invisible during a game — they don't show up in either team rail, so this
    is the only signal that someone's looking on. Deliberately understated: a
    small static eye + number, dimmed, so it reads as ambient info rather than
    a primary status. Renders nothing when no one's spectating. */
export default function SpectatorBadge({ count }: Props) {
  if (count <= 0) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-dim"
      title={`${count} ${count === 1 ? "person" : "people"} watching`}
    >
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.3}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="w-3.5 h-3.5"
      >
        <path d="M1 8s2.6-4.5 7-4.5S15 8 15 8s-2.6 4.5-7 4.5S1 8 1 8z" />
        <circle cx="8" cy="8" r="1.9" fill="currentColor" stroke="none" />
      </svg>
      <span className="font-[family-name:var(--font-display)] text-xs font-bold tabular-nums leading-none">
        {count}
      </span>
    </span>
  );
}
