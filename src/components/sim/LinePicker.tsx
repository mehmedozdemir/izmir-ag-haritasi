import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { TARIFFS, type Mode } from '../../fare/tariffs'
import { MODE_META, type RouteInfo } from '../../transit/data'

type Props = {
  routes: RouteInfo[]
  value: RouteInfo | undefined
  onChange: (route: RouteInfo) => void
}

const MODES: (Mode | 'all')[] = ['all', 'bus', 'metro', 'tram', 'izban', 'ferry']

const normalize = (s: string) => s.toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ')

export function LineBadge({ route, small }: { route: RouteInfo; small?: boolean }) {
  const label = route.ref || MODE_META[route.mode].label
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-md font-display font-bold text-white ${small ? 'min-w-8 px-1.5 text-xs' : 'min-w-10 px-2 py-0.5 text-sm'}`}
      style={{ background: route.color }}
    >
      {label}
    </span>
  )
}

export function LinePicker({ routes, value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<Mode | 'all'>('all')
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const filtered = useMemo(() => {
    const q = normalize(query.trim())
    return routes
      .filter((r) => mode === 'all' || r.mode === mode)
      .filter((r) => !q || normalize(r.ref).startsWith(q) || normalize(r.name).includes(q))
      .sort((a, b) => {
        // Hat numarası tam eşleşen en üstte.
        const ea = normalize(a.ref) === q ? 0 : 1
        const eb = normalize(b.ref) === q ? 0 : 1
        return ea - eb
      })
      .slice(0, 60)
  }, [routes, query, mode])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const choose = (r: RouteInfo) => {
    onChange(r)
    setOpen(false)
    setQuery('')
  }

  if (!open && value) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-left hover:border-[var(--muted)]"
      >
        <LineBadge route={value} />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--ink)]">{value.name}</span>
        <TariffTag code={value.tariff} />
      </button>
    )
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        autoFocus={open}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label="Hat ara"
        placeholder="Hat numarası veya adı (ör. 35, Metro, Konak)"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((a) => Math.min(a + 1, filtered.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === 'Enter' && filtered[active]) {
            e.preventDefault()
            choose(filtered[active])
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
        className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--ink)]"
      />
      {open && (
        <div className="absolute z-[1000] mt-1 w-full overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-lg">
          <div className="flex gap-1 overflow-x-auto border-b border-[var(--line)] p-1.5">
            {MODES.map((m) => (
              <button
                key={m}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setMode(m)
                  setActive(0)
                }}
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${mode === m ? 'bg-[var(--ink)] text-[var(--bg)]' : 'text-[var(--muted)] hover:bg-[var(--track)]'}`}
              >
                {m === 'all' ? 'Tümü' : MODE_META[m].label}
              </button>
            ))}
          </div>
          <ul id={listId} role="listbox" className="max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 && <li className="px-3 py-2 text-sm text-[var(--muted)]">Eşleşen hat yok</li>}
            {filtered.map((r, i) => (
              <li
                key={r.id}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(r)}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-2 px-2 py-1.5 ${i === active ? 'bg-[var(--track)]' : ''}`}
              >
                <LineBadge route={r} small />
                <span className="min-w-0 flex-1 truncate text-sm text-[var(--ink)]">{r.name}</span>
                <TariffTag code={r.tariff} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function TariffTag({ code }: { code: RouteInfo['tariff'] }) {
  if (code === 'A') return null
  return (
    <span title={`${TARIFFS[code].label} tarifesi (${code})`} className="shrink-0 rounded border border-[var(--line)] px-1 text-[10px] font-bold text-[var(--muted)]">
      {code}
    </span>
  )
}
