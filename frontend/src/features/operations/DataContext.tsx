import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { alerts as simAlerts, zones as simZones, type Alert, type Zone } from './model'
import { fetchLive } from './live'

export type DataMode = 'live' | 'simulated'
type Data = { alerts: Alert[]; zones: Zone[]; mode: DataMode; zoneName: (id: string) => string }

const fallback: Data = { alerts: simAlerts, zones: simZones, mode: 'simulated', zoneName: id => simZones.find(z => z.id === id)?.name ?? id }
const Ctx = createContext<Data>(fallback)
export const useData = () => useContext(Ctx)

const POLL_MS = 3000

/** Consulta os serviços a cada 3 s. Se falhar, usa os dados simulados (nunca mistura os dois). */
export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Omit<Data, 'zoneName'>>({ alerts: simAlerts, zones: simZones, mode: 'simulated' })
  useEffect(() => {
    let alive = true
    const tick = async () => {
      try {
        const live = await fetchLive()
        if (alive) setData({ alerts: live.alerts, zones: live.zones, mode: 'live' })
      } catch {
        if (alive) setData(prev => prev.mode === 'simulated' ? prev : { alerts: simAlerts, zones: simZones, mode: 'simulated' })
      }
    }
    tick()
    const t = setInterval(tick, POLL_MS)
    return () => { alive = false; clearInterval(t) }
  }, [])
  const value = useMemo<Data>(() => ({ ...data, zoneName: id => data.zones.find(z => z.id === id)?.name ?? id }), [data])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
