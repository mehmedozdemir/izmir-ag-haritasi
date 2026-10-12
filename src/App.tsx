import { useState } from 'react'
import { todayInIstanbul, useFare } from './api'
import { FarePanel } from './components/FarePanel'
import { NetworkMap } from './components/NetworkMap'

export default function App() {
  const [fromId, setFromId] = useState<number | null>(null)
  const [toId, setToId] = useState<number | null>(null)
  const [date, setDate] = useState(todayInIstanbul)

  const fare = useFare(fromId, toId, date)

  // Haritada tıklama sırası: önce biniş, sonra iniş; ikisi de seçiliyse yeni biniş.
  const handleStationClick = (id: number) => {
    if (fromId === null || toId !== null) {
      setFromId(id)
      setToId(null)
    } else if (id === fromId) {
      setFromId(null)
    } else {
      setToId(id)
    }
  }

  return (
    <div className="flex h-dvh flex-col md:flex-row">
      <main className="relative min-h-0 flex-1">
        <NetworkMap fromId={fromId} toId={toId} onStationClick={handleStationClick} />
        <Legend />
      </main>
      <aside className="max-h-[55dvh] shrink-0 overflow-y-auto border-t border-[var(--line)] bg-[var(--bg)] p-4 md:max-h-none md:w-[380px] md:border-t-0 md:border-l md:p-6">
        <FarePanel
          fromId={fromId}
          toId={toId}
          date={date}
          onFromChange={setFromId}
          onToChange={setToId}
          onSwap={() => {
            setFromId(toId)
            setToId(fromId)
          }}
          onClear={() => {
            setFromId(null)
            setToId(null)
          }}
          onDateChange={(d) => setDate(d || todayInIstanbul())}
          fare={fare.data}
          isLoading={fare.isLoading}
          error={fare.error}
        />
      </aside>
    </div>
  )
}

function Legend() {
  return (
    <div className="pointer-events-none absolute top-3 left-3 z-[500] flex flex-col gap-1 rounded-lg bg-[var(--bg)]/90 px-3 py-2 text-xs font-semibold text-[var(--ink)] shadow-sm backdrop-blur">
      <span className="flex items-center gap-2">
        <span className="h-1.5 w-5 rounded-full bg-[var(--izban)]" /> İZBAN
      </span>
      <span className="flex items-center gap-2">
        <span className="h-1.5 w-5 rounded-full bg-[var(--metro)]" /> Metro M1
      </span>
    </div>
  )
}
