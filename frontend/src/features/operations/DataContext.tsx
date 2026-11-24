import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { alerts as simAlerts, zones as simZones, type Alert, type Reviews, type Zone } from './model'
import { AuthRequired, clearSession, loginRequest, readSession, saveSession, type Session } from '../auth/session'
import { LoginPage } from '../auth/LoginPage'
import { fetchCameraSignals, fetchLive, type ApiCamera, type CameraSignal } from './live'

export type DataMode = 'live' | 'simulated' | 'loading' | 'offline' | 'auth'

// Dados de exemplo só entram se pedidos de propósito (desenvolvimento/testes): localStorage['visao-do-porto.demo']='1'.
const demoAllowed = () => { try { return localStorage.getItem('visao-do-porto.demo') === '1' } catch { return false } }
type Data = { alerts: Alert[]; zones: Zone[]; mode: DataMode; zoneName: (id: string) => string; reviews: Reviews; refresh: () => void
  cameras: ApiCamera[]; signals: Record<string, CameraSignal>; signalsKnown: boolean
  session: Session | null; signIn: (u: string, p: string) => Promise<string | void>; signOut: () => void }

type Base = Omit<Data, 'zoneName' | 'refresh' | 'cameras' | 'signals' | 'signalsKnown' | 'session' | 'signIn' | 'signOut'>
const fallback: Data = { alerts: simAlerts, zones: simZones, mode: 'simulated', zoneName: id => simZones.find(z => z.id === id)?.name ?? id, reviews: {}, refresh: () => {}, cameras: [], signals: {}, signalsKnown: false, session: null, signIn: async () => {}, signOut: () => {} }
const Ctx = createContext<Data>(fallback)
export const useData = () => useContext(Ctx)

const POLL_MS = 3000

/** Consulta os serviços a cada 3 s. Se falharem: mostra "indisponível" (ou, só em modo demo, dados de exemplo). */
export function DataProvider({ children }: { children: ReactNode }) {
  const demo = demoAllowed()
  const empty: Base = demo ? { alerts: simAlerts, zones: simZones, mode: 'simulated', reviews: {} } : { alerts: [], zones: [], mode: 'loading', reviews: {} }
  const [data, setData] = useState<Base>(empty)
  const [session, setSession] = useState<Session | null>(readSession)
  const [cameras, setCameras] = useState<ApiCamera[]>([])
  const [signals, setSignals] = useState<Record<string, CameraSignal>>({})
  const [signalsKnown, setSignalsKnown] = useState(false)
  const fusionWsOpen = useRef(false)
  const tickRef = useRef<() => void>(() => {})
  useEffect(() => {
    let alive = true
    const tick = async () => {
      try {
        const live = await fetchLive()
        if (alive) setData({ alerts: live.alerts, zones: live.zones, mode: 'live', reviews: live.reviews })
        setCameras(live.cameras)
      } catch (e) {
        if (e instanceof AuthRequired) { clearSession(); if (alive) { setSession(null); setData({ alerts: [], zones: [], mode: 'auth', reviews: {} }) } return }
        if (alive) setData(demo ? { alerts: simAlerts, zones: simZones, mode: 'simulated', reviews: {} } : { alerts: [], zones: [], mode: 'offline', reviews: {} })
      }
    }
    const tickSignals = async () => {
      if (fusionWsOpen.current) return            // WebSocket aberto: não precisa consultar
      try { const s = await fetchCameraSignals(); if (alive) { setSignals(s); setSignalsKnown(true) } }
      catch { if (alive) setSignalsKnown(false) }
    }
    tickRef.current = tick
    tick(); tickSignals()
    const t = setInterval(() => { tick(); tickSignals() }, POLL_MS)   // reserva: continua consultando mesmo com o WebSocket
    // WebSocket do Incident: qualquer evento dispara uma releitura imediata (sem esperar os 3 s).
    let ws: WebSocket | undefined
    let retry: ReturnType<typeof setTimeout> | undefined
    const connect = () => {
      try {
        const proto = location.protocol === 'https:' ? 'wss' : 'ws'
        const tk = readSession()?.token
        ws = new WebSocket(`${proto}://${location.host}/api/epi/incident/ws/incidents${tk ? '?token=' + encodeURIComponent(tk) : ''}`)
        ws.onmessage = ev => { try { if (JSON.parse(ev.data).type !== 'SNAPSHOT') tick() } catch { /* ignora */ } }
        ws.onclose = () => { if (alive) retry = setTimeout(connect, 5000) }
        ws.onerror = () => ws?.close()
      } catch { /* sem WebSocket: segue só com a consulta */ }
    }
    connect()
    // WebSocket do Fusion: estado de sinal das câmeras (snapshot + mudanças), sem consulta repetida.
    let fws: WebSocket | undefined
    let fretry: ReturnType<typeof setTimeout> | undefined
    const connectFusion = () => {
      try {
        const proto = location.protocol === 'https:' ? 'wss' : 'ws'
        fws = new WebSocket(`${proto}://${location.host}/api/epi/fusion/fusion/ws/cameras`)
        fws.onopen = () => { fusionWsOpen.current = true; setSignalsKnown(true) }
        fws.onmessage = ev => {
          try {
            const m = JSON.parse(ev.data)
            if (m.type === 'SNAPSHOT') setSignals(Object.fromEntries((m.cameras as { camera_id: string; status: CameraSignal }[]).map(c => [c.camera_id, c.status])))
            else if (m.type === 'CAMERA_STATUS_CHANGED') setSignals(prev => ({ ...prev, [m.camera_id]: m.status }))
          } catch { /* ignora */ }
        }
        fws.onclose = () => { fusionWsOpen.current = false; if (alive) fretry = setTimeout(connectFusion, 5000) }
        fws.onerror = () => fws?.close()
      } catch { /* sem WebSocket: segue com a consulta */ }
    }
    connectFusion()
    return () => { alive = false; clearInterval(t); clearTimeout(retry); clearTimeout(fretry); ws?.close(); fws?.close() }
  }, [])
  const value = useMemo<Data>(() => ({ ...data, zoneName: id => data.zones.find(z => z.id === id)?.name ?? id, refresh: () => tickRef.current(), cameras, signals, signalsKnown, session,
    signIn: async (u: string, p: string) => {
      try { const s = await loginRequest(u, p); saveSession(s); setSession(s); tickRef.current() }
      catch (e) { return e instanceof Error ? e.message : 'Não foi possível entrar.' }
    },
    signOut: () => { clearSession(); setSession(null); setData({ alerts: [], zones: [], mode: 'auth', reviews: {} }); tickRef.current() } }), [data, cameras, signals, signalsKnown, session])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** Só mostra as telas operacionais quando há dados reais (ou demo explícito). */
export function DataGate({ children }: { children: ReactNode }) {
  const { mode, signIn } = useData()
  if (mode === 'live' || mode === 'simulated') return <>{children}</>
  if (mode === 'auth') return <LoginPage onLogin={signIn} />
  return <section className="panel" role="status" aria-live="polite">
    <div className="panel-head"><div>
      <h2>{mode === 'loading' ? 'Conectando aos serviços…' : 'Serviços indisponíveis'}</h2>
      <p>{mode === 'loading' ? 'Aguardando resposta do Incident e do Tracker.' : 'Não foi possível ler o Incident (:8004) e o Tracker (:8010). Verifique se os serviços do EPI Vision estão ligados. A tela tenta de novo a cada 3 segundos.'}</p>
    </div></div>
  </section>
}
