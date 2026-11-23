import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { alerts as simAlerts, zones as simZones, type Alert, type Reviews, type Zone } from './model'
import { fetchLive } from './live'

export type DataMode = 'live' | 'simulated' | 'loading' | 'offline'

// Dados de exemplo só entram se pedidos de propósito (desenvolvimento/testes): localStorage['visao-do-porto.demo']='1'.
const demoAllowed = () => { try { return localStorage.getItem('visao-do-porto.demo') === '1' } catch { return false } }
type Data = { alerts: Alert[]; zones: Zone[]; mode: DataMode; zoneName: (id: string) => string; reviews: Reviews; refresh: () => void }

const fallback: Data = { alerts: simAlerts, zones: simZones, mode: 'simulated', zoneName: id => simZones.find(z => z.id === id)?.name ?? id, reviews: {}, refresh: () => {} }
const Ctx = createContext<Data>(fallback)
export const useData = () => useContext(Ctx)

const POLL_MS = 3000

/** Consulta os serviços a cada 3 s. Se falharem: mostra "indisponível" (ou, só em modo demo, dados de exemplo). */
export function DataProvider({ children }: { children: ReactNode }) {
  const demo = demoAllowed()
  const empty: Omit<Data, 'zoneName' | 'refresh'> = demo ? { alerts: simAlerts, zones: simZones, mode: 'simulated', reviews: {} } : { alerts: [], zones: [], mode: 'loading', reviews: {} }
  const [data, setData] = useState<Omit<Data, 'zoneName' | 'refresh'>>(empty)
  const tickRef = useRef<() => void>(() => {})
  useEffect(() => {
    let alive = true
    const tick = async () => {
      try {
        const live = await fetchLive()
        if (alive) setData({ alerts: live.alerts, zones: live.zones, mode: 'live', reviews: live.reviews })
      } catch {
        if (alive) setData(demo ? { alerts: simAlerts, zones: simZones, mode: 'simulated', reviews: {} } : { alerts: [], zones: [], mode: 'offline', reviews: {} })
      }
    }
    tickRef.current = tick
    tick()
    const t = setInterval(tick, POLL_MS)   // reserva: continua consultando mesmo com o WebSocket
    // WebSocket do Incident: qualquer evento dispara uma releitura imediata (sem esperar os 3 s).
    let ws: WebSocket | undefined
    let retry: ReturnType<typeof setTimeout> | undefined
    const connect = () => {
      try {
        const proto = location.protocol === 'https:' ? 'wss' : 'ws'
        ws = new WebSocket(`${proto}://${location.host}/api/epi/incident/ws/incidents`)
        ws.onmessage = ev => { try { if (JSON.parse(ev.data).type !== 'SNAPSHOT') tick() } catch { /* ignora */ } }
        ws.onclose = () => { if (alive) retry = setTimeout(connect, 5000) }
        ws.onerror = () => ws?.close()
      } catch { /* sem WebSocket: segue só com a consulta */ }
    }
    connect()
    return () => { alive = false; clearInterval(t); clearTimeout(retry); ws?.close() }
  }, [])
  const value = useMemo<Data>(() => ({ ...data, zoneName: id => data.zones.find(z => z.id === id)?.name ?? id, refresh: () => tickRef.current() }), [data])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** Só mostra as telas operacionais quando há dados reais (ou demo explícito). */
export function DataGate({ children }: { children: ReactNode }) {
  const { mode } = useData()
  if (mode === 'live' || mode === 'simulated') return <>{children}</>
  return <section className="panel" role="status" aria-live="polite">
    <div className="panel-head"><div>
      <h2>{mode === 'loading' ? 'Conectando aos serviços…' : 'Serviços indisponíveis'}</h2>
      <p>{mode === 'loading' ? 'Aguardando resposta do Incident e do Tracker.' : 'Não foi possível ler o Incident (:8004) e o Tracker (:8010). Verifique se os serviços do EPI Vision estão ligados. A tela tenta de novo a cada 3 segundos.'}</p>
    </div></div>
  </section>
}
