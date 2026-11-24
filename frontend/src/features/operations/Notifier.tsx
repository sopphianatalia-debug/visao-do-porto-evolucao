import { useEffect, useRef, useState } from 'react'
import { BellRing, Volume2, VolumeX } from 'lucide-react'
import type { Alert, Reviews } from './model'
import { useWorker, workerLine } from './useWorker'

const SOUND_KEY = 'visao-do-porto.alert-sound'
const readSound = () => { try { return localStorage.getItem(SOUND_KEY) !== 'off' } catch { return true } }

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx(); const o = ctx.createOscillator(); const g = ctx.createGain()
    o.type = 'sine'; o.frequency.value = 880; g.gain.value = 0.04          // discreto
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.18)
    o.onended = () => { void ctx.close() }
  } catch { /* sem áudio: o aviso visual continua */ }
}

/** Aviso ativo para o SUPERVISOR: incidente novo aparece como alerta na tela, com som discreto e contador no título da aba.
 *  Só leva texto (o quê, onde, quando); a imagem continua só dentro da revisão, com login. */
export function Notifier({ alerts, reviews, enabled, zoneName, onOpen }: { alerts: Alert[]; reviews: Reviews; enabled: boolean; zoneName: (id: string) => string; onOpen: (a: Alert) => void }) {
  const seen = useRef<Set<string> | null>(null)       // null = ainda não carregou a primeira lista
  const [fresh, setFresh] = useState<Alert[]>([])
  const [sound, setSound] = useState(readSound)
  const baseTitle = useRef(document.title.replace(/^\(\d+\)\s*/, ''))
  const pending = enabled ? alerts.filter(a => !reviews[a.id]) : []

  useEffect(() => {
    if (!enabled) { seen.current = null; setFresh([]); return }
    if (seen.current === null) { seen.current = new Set(alerts.map(a => a.id)); return }   // o que já existia ao abrir não é "novo"
    const novos = alerts.filter(a => !seen.current!.has(a.id) && !reviews[a.id])
    alerts.forEach(a => seen.current!.add(a.id))
    if (novos.length) { setFresh(f => [...novos, ...f].slice(0, 3)); if (sound) beep() }
  }, [alerts, reviews, enabled, sound])

  useEffect(() => {
    document.title = pending.length ? `(${pending.length}) ${baseTitle.current}` : baseTitle.current
    return () => { document.title = baseTitle.current }
  }, [pending.length])

  if (!enabled) return null
  const alive = fresh.filter(a => !reviews[a.id])
  return <>
    <button className="text-button notifier-sound" aria-pressed={sound} title={sound ? 'Som dos avisos ligado' : 'Som dos avisos desligado'}
      onClick={() => { const v = !sound; setSound(v); try { localStorage.setItem(SOUND_KEY, v ? 'on' : 'off') } catch { /* só nesta sessão */ } }}>
      {sound ? <Volume2 size={15} aria-hidden="true" /> : <VolumeX size={15} aria-hidden="true" />} Som {sound ? 'ligado' : 'desligado'}
    </button>
    <div className="notifier" role="status" aria-live="assertive" data-testid="notifier">
      {alive.map(a => <NotifierItem key={a.id} a={a} zoneName={zoneName}
        onOpen={() => { onOpen(a); setFresh(f => f.filter(x => x.id !== a.id)) }}
        onDismiss={() => setFresh(f => f.filter(x => x.id !== a.id))} />)}
    </div>
  </>
}

function NotifierItem({ a, zoneName, onOpen, onDismiss }: { a: Alert; zoneName: (id: string) => string; onOpen: () => void; onDismiss: () => void }) {
  const worker = useWorker(a.employee, true)      // o Notifier só existe para o supervisor
  return <div className="notifier-item">
    <BellRing size={18} aria-hidden="true" />
    <span><strong>Novo incidente: {a.title}</strong><small>Trabalhador: {a.employee ? workerLine(worker, a.employee) : 'não identificado'}</small><small>{zoneName(a.zone)} · {a.camera} · {a.id}</small></span>
    <button className="button primary" onClick={onOpen}>Abrir</button>
    <button className="icon-button" aria-label="Dispensar aviso" onClick={onDismiss}>×</button>
  </div>
}
