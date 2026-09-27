import { ZODIAC_GLYPHS } from '#/lib/zodiac-glyphs'
import { cx } from './ui'

/** Zodiac sign glyph; inherits colour from `currentColor`. */
export function ZodiacIcon({ sign, className, label }: { sign: string; className?: string; label?: string }) {
  const g = ZODIAC_GLYPHS[sign]
  if (!g) return null
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx('size-5 shrink-0', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {g.paths.map((d) => (
        <path key={d} d={d} />
      ))}
      {g.circles?.map(([cx_, cy, r]) => (
        <circle key={`${cx_}-${cy}`} cx={cx_} cy={cy} r={r} />
      ))}
    </svg>
  )
}

/** Glyph in a soft round badge, for lists. */
export function ZodiacBadge({ sign, className }: { sign: string; className?: string }) {
  return (
    <span className={cx('grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent', className)}>
      <ZodiacIcon sign={sign} className="size-[18px]" />
    </span>
  )
}
