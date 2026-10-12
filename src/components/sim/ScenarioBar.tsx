import { useEffect, useRef, useState } from 'react'
import { CARD_TYPES } from '../../fare/tariffs'
import type { RouteInfo } from '../../transit/data'
import { applyInput, scenarioName, scenarioToInput, type Scenario, type ScenarioInput } from '../../sim/scenarios'
import { useSimulation } from '../../sim/useSimulation'
import { tl } from './LegCard'

/** Düzenlenen senaryo: yeni oluşturma formu ya da mevcut senaryonun kimliği. */
export type ScenarioEditing = 'new' | string | null

type Props = {
  scenarios: Scenario[]
  activeId: string | null
  editing: ScenarioEditing
  onEditing: (e: ScenarioEditing) => void
  onSelect: (id: string) => void
  newInput: () => ScenarioInput
  onCreate: (input: ScenarioInput) => void
  onUpdate: (s: Scenario) => void
  onDuplicate: (s: Scenario) => void
  onDelete: (s: Scenario) => void
  onLoadExample: () => void
  routesById: Map<string, RouteInfo> | undefined
  floating: boolean
  /** Şerit satırının sağ ucuna yerleşecek öğe (ör. kart yerleşimi seçici). */
  trailing?: React.ReactNode
  /** Form ve boş durum kartının hizası (sağ üst yerleşimde sağa). */
  align?: 'start' | 'end'
}

const shortDate = (iso: string) => iso.split('-').reverse().slice(0, 2).join('.')

/** Biniş kartlarının üstündeki senaryo şeridi + oluşturma/düzenleme formu. */
export function ScenarioBar(props: Props) {
  const { scenarios, activeId, editing, onEditing, floating, trailing, align = 'start' } = props
  const editingScenario = editing && editing !== 'new' ? scenarios.find((s) => s.id === editing) : undefined
  const surface = floating ? 'shadow-md' : ''
  // Harita üzerinde form/boş durum kartı biniş sütunu genişliğinde, yerleşime göre sola ya da sağa hizalı.
  const panelWidth = floating ? `w-[360px] max-w-full ${align === 'end' ? 'self-end' : 'self-start'}` : ''

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 items-start gap-2">
      {/* Şerit yalnızca kartlar kadar yer kaplar (boş alan haritayı engellemez); sığmazsa yatay kayar. */}
      <div className="thin-scroll pointer-events-auto flex min-w-0 items-stretch gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Senaryolar">
        <button
          type="button"
          onClick={() => onEditing(editing === 'new' ? null : 'new')}
            title="Yeni senaryo oluştur"
          className={`flex shrink-0 items-center gap-1 rounded-xl border border-dashed px-3 py-2 text-sm font-semibold transition ${surface} ${
            editing === 'new'
              ? 'border-[var(--ink)] bg-[var(--surface)] text-[var(--ink)]'
              : 'border-[var(--muted)] bg-[var(--bg)]/90 text-[var(--ink)] backdrop-blur hover:bg-[var(--surface)]'
          }`}
        >
          <span aria-hidden className="text-base leading-none">＋</span> {scenarios.length > 0 ? 'Yeni' : 'Yeni senaryo'}
        </button>
        {scenarios.map((s) => (
          <ScenarioChip
            key={s.id}
            scenario={s}
            active={s.id === activeId}
            floating={floating}
            routesById={props.routesById}
            onClick={() => {
              if (s.id === activeId) onEditing(editing === s.id ? null : s.id)
              else {
                props.onSelect(s.id)
                onEditing(null)
              }
            }}
          />
        ))}
      </div>
      {trailing && <div className="pointer-events-auto ml-auto shrink-0">{trailing}</div>}
      </div>

      {scenarios.length === 0 && editing !== 'new' && (
        <div className={`pointer-events-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-sm ${surface} ${panelWidth}`}>
          <p className="font-semibold text-[var(--ink)]">Henüz senaryo yok</p>
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">
            Bir senaryo oluşturun; ardından binişleri sırayla ekleyerek her binişte kartınızdan ne kadar kesileceğini görün.
          </p>
          <button type="button" onClick={props.onLoadExample} className="mt-2 text-xs font-semibold text-[var(--info)] hover:underline">
            Örnek senaryo yükle
          </button>
        </div>
      )}

      {editing === 'new' && (
        <ScenarioForm
          mode="new"
          initial={props.newInput()}
          floating={floating}
          className={panelWidth}
          onClose={() => onEditing(null)}
          onSubmit={(input) => {
            props.onCreate(input)
            onEditing(null)
          }}
        />
      )}
      {editingScenario && (
        <ScenarioForm
          key={editingScenario.id}
          mode="edit"
          initial={scenarioToInput(editingScenario)}
          floating={floating}
          className={panelWidth}
          legCount={editingScenario.legs.length}
          onClose={() => onEditing(null)}
          onChange={(input) => props.onUpdate(applyInput(editingScenario, input))}
          onClearLegs={() => props.onUpdate({ ...editingScenario, legs: [] })}
          onDuplicate={() => {
            props.onDuplicate(editingScenario)
            onEditing(null)
          }}
          onDelete={() => {
            props.onDelete(editingScenario)
            onEditing(null)
          }}
        />
      )}
    </div>
  )
}

function ScenarioChip({
  scenario,
  active,
  floating,
  routesById,
  onClick,
}: {
  scenario: Scenario
  active: boolean
  floating: boolean
  routesById: Map<string, RouteInfo> | undefined
  onClick: () => void
}) {
  // Her senaryonun toplamı kendi kart tipine göre (ücretler önbellekten paylaşılır).
  const { results, resolved } = useSimulation(scenario, routesById)
  const r = results[scenario.detailCard]
  const hasLegs = resolved.some((l) => l.complete)
  const card = CARD_TYPES.find((c) => c.type === scenario.detailCard)!.label
  const ref = useRef<HTMLButtonElement>(null)
  // Seçilen senaryo şeritte görünür alana kaysın.
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [active])

  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      title={active ? 'Senaryo bilgilerini düzenle' : 'Senaryoyu seç'}
      className={`flex w-40 shrink-0 flex-col rounded-xl border px-3 py-1.5 text-left transition ${floating ? 'shadow-md' : ''} ${
        active
          ? 'border-[var(--ink)] bg-[var(--surface)]'
          : `border-[var(--line)] bg-[var(--surface)] ${floating ? 'opacity-75 hover:opacity-100' : 'hover:border-[var(--muted)]'}`
      }`}
    >
      <span className="flex items-center gap-1">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--ink)]">{scenarioName(scenario)}</span>
        {active && <span aria-hidden className="text-xs text-[var(--muted)]">✎</span>}
      </span>
      <span className="text-[11px] tabular-nums text-[var(--muted)]">
        {shortDate(scenario.date)} · {scenario.startTime} · {card}
      </span>
      <span className="font-display text-base font-bold tabular-nums text-[var(--ink)]">
        {!hasLegs ? <span className="text-xs font-semibold text-[var(--muted)]">Biniş yok</span> : r.total === null ? '…' : tl(r.total)}
      </span>
    </button>
  )
}

type FormProps = {
  mode: 'new' | 'edit'
  initial: ScenarioInput
  floating: boolean
  className?: string
  legCount?: number
  onClose: () => void
  onSubmit?: (input: ScenarioInput) => void
  onChange?: (input: ScenarioInput) => void
  onClearLegs?: () => void
  onDuplicate?: () => void
  onDelete?: () => void
}

function ScenarioForm({ mode, initial, floating, className = '', legCount = 0, onClose, onSubmit, onChange, onClearLegs, onDuplicate, onDelete }: FormProps) {
  const [draft, setDraft] = useState(initial)
  const ref = useRef<HTMLFormElement>(null)
  // Düzenlemede değerler doğrudan senaryodan gelir ve değişiklikler anında uygulanır (yan panelden yapılan
  // değişikliklerle tutarlı kalır); yeni senaryoda "Oluştur"a kadar yerel taslakta tutulur.
  const input = mode === 'edit' ? initial : draft
  const set = (patch: Partial<ScenarioInput>) => {
    if (mode === 'edit') onChange?.({ ...initial, ...patch })
    else setDraft((d) => ({ ...d, ...patch }))
  }

  // Dışarı tıklayınca ya da Esc ile kapan (yeni senaryoda vazgeçilmiş sayılır).
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as Element).closest?.('[aria-label="Senaryolar"]')) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <form
      ref={ref}
      onSubmit={(e) => {
        e.preventDefault()
        if (mode === 'new') onSubmit?.(input)
        else onClose()
      }}
      className={`pointer-events-auto flex shrink-0 flex-col gap-2.5 rounded-xl border border-[var(--ink)] bg-[var(--surface)] p-3 text-sm ${floating ? 'shadow-lg' : ''} ${className}`}
      aria-label={mode === 'new' ? 'Yeni senaryo' : 'Senaryo bilgileri'}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{mode === 'new' ? 'Yeni senaryo' : 'Senaryo bilgileri'}</h3>
        <button type="button" onClick={onClose} aria-label="Kapat" className="grid h-6 w-6 place-items-center rounded text-[var(--muted)] hover:bg-[var(--track)]">
          {mode === 'new' ? '✕' : '✓'}
        </button>
      </div>

      <Field label="Senaryo adı">
        <input
          autoFocus={mode === 'new'}
          required
          value={input.name}
          onChange={(e) => set({ name: e.target.value })}
          className="input"
          maxLength={60}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Tarih">
          <input type="date" required value={input.date} onChange={(e) => e.target.value && set({ date: e.target.value })} className="input" />
        </Field>
        <Field label="İlk biniş saati">
          <input type="time" required value={input.startTime} onChange={(e) => e.target.value && set({ startTime: e.target.value })} className="input" />
        </Field>
        <Field label="Kart tipi">
          <select value={input.card} onChange={(e) => set({ card: e.target.value as ScenarioInput['card'] })} className="input">
            {CARD_TYPES.map((c) => (
              <option key={c.type} value={c.type}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Başlangıç bakiyesi (TL)" hint="Boş bırakılırsa bakiye takip edilmez">
          <input
            type="number"
            min={0}
            step="0.01"
            placeholder="—"
            value={input.startBalance ?? ''}
            onChange={(e) => set({ startBalance: e.target.value === '' ? null : Number(e.target.value) })}
            className="input"
          />
        </Field>
        <Field label="Aktarma süresi (dk)" hint="İnişten sonraki binişe kadar yürüme/bekleme">
          <input
            type="number"
            min={0}
            max={120}
            value={input.transferBufferMin}
            onChange={(e) => set({ transferBufferMin: Math.max(0, Number(e.target.value) || 0) })}
            className="input"
          />
        </Field>
        <label className="flex cursor-pointer items-end gap-2 pb-1.5" title="Açıkken 90 dk içinde İZBAN'da ilk 20 km ücreti ödenmiş sayılır">
          <input
            type="checkbox"
            checked={input.izbanTransfer}
            onChange={(e) => set({ izbanTransfer: e.target.checked })}
            className="h-4 w-4 accent-[var(--izban)]"
          />
          <span className="text-xs font-semibold text-[var(--ink)]">İZBAN aktarmaya dahil</span>
        </label>
      </div>

      {mode === 'new' ? (
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--track)]">
            Vazgeç
          </button>
          <button type="submit" className="rounded-lg bg-[var(--ink)] px-3 py-1.5 text-sm font-semibold text-[var(--bg)] hover:opacity-90">
            Oluştur
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-[var(--line)] pt-2 text-xs font-semibold">
          <button
            type="button"
            disabled={legCount === 0}
            onClick={() => window.confirm(`"${input.name}" senaryosundaki ${legCount} biniş silinsin mi?`) && onClearLegs?.()}
            className="text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-40"
          >
            Binişleri temizle
          </button>
          <button type="button" onClick={onDuplicate} className="text-[var(--muted)] hover:text-[var(--ink)]">
            Senaryoyu çoğalt
          </button>
          <button
            type="button"
            onClick={() => window.confirm(`"${input.name}" senaryosu ve binişleri silinsin mi?`) && onDelete?.()}
            className="ml-auto text-[var(--warn)] hover:underline"
          >
            Senaryoyu sil
          </button>
        </div>
      )}
    </form>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-0.5" title={hint}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</span>
      {children}
    </label>
  )
}
