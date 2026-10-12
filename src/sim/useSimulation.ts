import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'
import { fetchEshotFare, fetchFare, type FareResult } from '../api'
import { simulate, type DistanceQuote, type LegInput, type SimulationResult } from '../fare/engine'
import { CARD_TYPES, TARIFFS, isHalkTasit, type CardType, type TariffCode } from '../fare/tariffs'
import { haversineKm, routeDetailQuery, type Direction, type RouteInfo, type Stop } from '../transit/data'
import { toMin, type Journey, type LegDraft } from './journey'

export type ResolvedLeg = {
  draft: LegDraft
  route?: RouteInfo
  dir?: Direction
  from?: Stop
  to?: Stop
  tariff?: TariffCode
  boardMin: number
  alightMin: number
  autoBoard: boolean
  complete: boolean
  quote?: DistanceQuote
  quoteState?: { loading: boolean; error?: string; km?: number }
}

function izbanToQuote(r: FareResult): DistanceQuote {
  const get = (t: string) => {
    const f = r.fares.find((x) => x.type === t)!
    return { price: f.price, minBalance: f.minBalance, refund: f.refund }
  }
  return { tam: get('tam'), genc: get('ogrenci'), ogretmen: get('ogretmen'), yas60: get('yas60') }
}

export function useSimulation(journey: Journey, routesById: Map<string, RouteInfo> | undefined) {
  const routeIds = [...new Set(journey.legs.map((l) => l.routeId).filter((x): x is string => !!x))]
  const details = useQueries({ queries: routeIds.map((id) => routeDetailQuery(id)) })
  const detailById = new Map(routeIds.map((id, i) => [id, details[i].data]))

  // 1) Bacakları çöz ve saatleri hesapla.
  const base: ResolvedLeg[] = []
  let cursor = toMin(journey.startTime)
  journey.legs.forEach((draft, i) => {
    const route = draft.routeId ? routesById?.get(draft.routeId) : undefined
    const dir = draft.routeId ? detailById.get(draft.routeId)?.dirs.find((d) => d.id === draft.dirId) : undefined
    const fromIdx = dir ? dir.stops.findIndex((s) => s.id === draft.fromStopId) : -1
    // Sıralı hatlarda iniş durağı, yön boyunca binişten sonra gelmeli (vapurda sıra yok).
    const toIdx = dir
      ? route?.anyOrder
        ? dir.stops.findIndex((s) => s.id === draft.toStopId)
        : dir.stops.findIndex((s, i) => i > fromIdx && s.id === draft.toStopId)
      : -1
    const from = fromIdx >= 0 ? dir!.stops[fromIdx] : undefined
    const to = toIdx >= 0 ? dir!.stops[toIdx] : undefined

    let boardMin = i === 0 ? cursor : cursor + journey.transferBufferMin
    if (draft.boardOverride) {
      const day = Math.floor(cursor / 1440) * 1440
      boardMin = day + toMin(draft.boardOverride)
      if (boardMin < cursor - 60) boardMin += 1440 // gece yarısını geçen yolculuk
    }
    let travel = 0
    if (from && to && route) {
      travel = route.anyOrder
        ? (haversineKm([from.lat, from.lng], [to.lat, to.lng]) / (route.speedKmh ?? 20)) * 60
        : Math.abs(to.t - from.t) / 60
    }
    const alightMin = boardMin + Math.max(1, Math.round(travel))
    cursor = alightMin
    base.push({
      draft,
      route,
      dir,
      from,
      to,
      tariff: route?.tariff,
      boardMin,
      alightMin,
      autoBoard: !draft.boardOverride,
      complete: !!(route && from && to && from.id !== to.id),
    })
  })

  // 2) Mesafe bazlı bacaklar için ücretleri sunucudan al.
  const quoteQueries = useQueries({
    queries: base.map((l) => {
      const rule = l.tariff ? TARIFFS[l.tariff] : undefined
      if (!l.complete || !rule?.distanceBased) return { queryKey: ['noquote', l.draft.id], queryFn: () => null, enabled: false }
      if (rule.distanceBased === 'izban') {
        const [a, b] = [Number(l.from!.code), Number(l.to!.code)]
        return {
          queryKey: ['fare', a, b, journey.date],
          queryFn: () => fetchFare(a, b, journey.date),
          staleTime: 60 * 60 * 1000,
          retry: 1,
        }
      }
      const htt = isHalkTasit(((l.boardMin % 1440) + 1440) % 1440)
      const dir = l.dir!.id === '0' ? 1 : 2
      return {
        queryKey: ['eshot', l.route!.ref, dir, l.from!.code, l.to!.code, htt],
        queryFn: () => fetchEshotFare(l.route!.ref, dir, l.from!.code, l.to!.code, htt),
        staleTime: 60 * 60 * 1000,
        retry: 1,
      }
    }),
  })

  const resolved: ResolvedLeg[] = base.map((l, i) => {
    const q = quoteQueries[i]
    const rule = l.tariff ? TARIFFS[l.tariff] : undefined
    if (!rule?.distanceBased || !l.complete) return l
    const data = q.data as FareResult | { km: number; quote: DistanceQuote } | null | undefined
    let quote: DistanceQuote | undefined
    let km: number | undefined
    if (data && 'fares' in data) {
      quote = izbanToQuote(data)
      km = data.km
    } else if (data && 'quote' in data) {
      quote = data.quote
      km = data.km
    }
    return { ...l, quote, quoteState: { loading: q.isLoading, error: q.error?.message, km } }
  })

  // 3) Dört kart tipi için simülasyon (girdiler değişmedikçe yeniden hesaplanmaz).
  const inputs: LegInput[] = resolved
    .filter((l) => l.complete)
    .map((l) => ({
      id: l.draft.id,
      mode: l.route!.mode,
      ref: l.route!.ref,
      tariff: l.tariff!,
      // 30 dk kuralı: otobüste aynı hat, raylı/vapurda aynı biniş istasyonu.
      repeatKey: l.route!.mode === 'bus' ? `bus:${l.route!.ref}` : `${l.route!.mode}:${l.from!.name}`,
      boardMin: l.boardMin,
      alightMin: l.alightMin,
      quote: l.quote,
    }))
  const inputKey = JSON.stringify([inputs, journey.settings, journey.startBalance])
  const results = useMemo(() => {
    const [legs, settings, balance] = JSON.parse(inputKey) as [LegInput[], Journey['settings'], number | null]
    return Object.fromEntries(
      CARD_TYPES.map(({ type }) => [type, simulate(legs, type, settings, balance ?? undefined)]),
    ) as Record<CardType, SimulationResult>
  }, [inputKey])

  return { resolved, results }
}
