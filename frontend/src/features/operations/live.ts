// Camada de dados "ao vivo": lê os serviços do EPI Vision (Incident :8004 e Tracker :8010)
// pelo proxy do Vite. Se não responderem, o front volta aos dados simulados e avisa na tela.
import type { Alert, Severity, Zone } from './model'

export const SECTORS: Record<string, { name: string; subtitle: string }> = {
  GRANEIS_SOLIDOS: { name: 'Granéis sólidos', subtitle: 'Operação de granéis sólidos' },
  GRANEIS_LIQUIDOS: { name: 'Granéis líquidos', subtitle: 'Operação de granéis líquidos' },
  CARGA_GERAL_CELULOSE: { name: 'Carga geral e celulose', subtitle: 'Movimentação de carga' },
  PIER_BORDO: { name: 'Píer e bordo', subtitle: 'Atracação e bordo' },
  MANUTENCAO_ENGENHARIA: { name: 'Manutenção e engenharia', subtitle: 'Oficinas e obras' },
  GUARDA_PORTUARIA: { name: 'Guarda portuária', subtitle: 'Acessos e vigilância' },
}
const NO_SECTOR = 'SEM_SETOR'
const PPE_LABEL: Record<string, string> = {
  helmet: 'capacete', hardhat: 'capacete', vest: 'colete', gloves: 'luvas', boots: 'botas', safety_vest: 'colete',
}
const ppeLabel = (t: string) => PPE_LABEL[t.toLowerCase()] ?? t

type ApiIncident = {
  incident_id: string; ppe_type: string; severity: string; status: string; reason: string
  rule_id: string; opened_at: string; duration_seconds: number; source_cameras: string[]; employee_id: string | null
}
type ApiCamera = { camera_id: string; name: string; sector: string | null; kind: string; active: boolean }

export type LiveData = { alerts: Alert[]; zones: Zone[]; cameras: ApiCamera[] }

async function getJson<T>(url: string): Promise<T> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 2500)
  try {
    const res = await fetch(url, { signal: ctl.signal })
    if (!res.ok) throw new Error(String(res.status))
    return await res.json() as T
  } finally { clearTimeout(timer) }
}

const severityOf = (s: string): Severity => (s === 'CRITICAL' || s === 'HIGH') ? 'critical' : 'attention'
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export function toAlert(i: ApiIncident, cameras: ApiCamera[]): Alert {
  const camId = i.source_cameras?.[0] ?? '—'
  const sector = cameras.find(c => c.camera_id === camId)?.sector ?? NO_SECTOR
  return {
    id: i.incident_id,
    title: `EPI ausente: ${ppeLabel(i.ppe_type)}`,
    type: i.status === 'OPEN' ? 'Equipamento de proteção · aberto' : 'Equipamento de proteção · resolvido',
    severity: severityOf(i.severity),
    zone: sector, camera: camId, time: hhmm(i.opened_at),
    rule: i.rule_id, reason: i.reason || 'Violação confirmada pelo Rules Engine.',
  }
}

export async function fetchLive(): Promise<LiveData> {
  const [incidents, cameras] = await Promise.all([
    getJson<ApiIncident[]>('/api/epi/incident/incidents?status=OPEN'),
    getJson<ApiCamera[]>('/api/epi/tracker/cameras'),
  ])
  const alerts = incidents.map(i => toAlert(i, cameras))
  const zones: Zone[] = Object.entries(SECTORS).map(([id, s]) => ({ id, name: s.name, subtitle: s.subtitle, grid: '' }))
  if (alerts.some(a => a.zone === NO_SECTOR)) zones.push({ id: NO_SECTOR, name: 'Sem setor', subtitle: 'Câmera sem setor cadastrado', grid: '' })
  return { alerts, zones, cameras }
}
