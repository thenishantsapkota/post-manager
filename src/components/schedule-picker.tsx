import { CalendarClock, FileText, Send } from 'lucide-react'
import { Input, cx } from './ui'
import { nptDateKey, nptTime, nptToEpoch } from '#/lib/time'

export type PublishMode = 'draft' | 'schedule' | 'now'

export interface ScheduleValue {
  mode: PublishMode
  date: string
  time: string
}

export function defaultSchedule(at?: number | null): ScheduleValue {
  // Default to the next full hour, Nepal time.
  const base = at ?? Math.ceil((Date.now() + 5 * 60_000) / 3600_000) * 3600_000
  return { mode: at ? 'schedule' : 'now', date: nptDateKey(base), time: nptTime(base) }
}

export function scheduleEpoch(v: ScheduleValue) {
  return nptToEpoch(v.date, v.time)
}

const MODES = [
  { value: 'now', label: 'Post now', icon: Send },
  { value: 'schedule', label: 'Schedule', icon: CalendarClock },
  { value: 'draft', label: 'Save draft', icon: FileText },
] as const

export function SchedulePicker({ value, onChange }: { value: ScheduleValue; onChange: (v: ScheduleValue) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {MODES.map((m) => {
          const Icon = m.icon
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => onChange({ ...value, mode: m.value })}
              className={cx(
                'flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-sm font-semibold transition-colors',
                value.mode === m.value ? 'border-accent bg-accent-soft text-accent' : 'border-border text-muted hover:bg-surface-2',
              )}
            >
              <Icon className="size-4" />
              {m.label}
            </button>
          )
        })}
      </div>
      {value.mode === 'schedule' && (
        <div>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={value.date} min={nptDateKey()} onChange={(e) => onChange({ ...value, date: e.target.value })} />
            <Input type="time" value={value.time} onChange={(e) => onChange({ ...value, time: e.target.value })} />
          </div>
          <p className="mt-1.5 text-[13px] text-muted">Nepal time (UTC+5:45)</p>
        </div>
      )}
    </div>
  )
}
