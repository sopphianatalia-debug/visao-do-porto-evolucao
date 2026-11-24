// Camada de dados "ao vivo": lê os serviços do EPI Vision (Incident :8004 e Tracker :8010)
// pelo proxy do Vite. Se não responderem, o front volta aos dados simulados e avisa na tela.
import { AuthRequired, authHeader, readSession } from '../auth/session'
import type { Alert, Decision, Review, Reviews, Severity, Zone } from './model'

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
  review_status?: string; reviewed_by?: string | null; reviewed_at?: string | null; review_note?: string | null
}
export type ApiCamera = { camera_id: string; name: string; sector: string | null; kind: string; active: boolean }

export type LiveData = { alerts: Alert[]; zones: Zone[]; cameras: ApiCamera[]; reviews: Reviews }

const DECISION: Record<string, Decision> = { CONFIRMED: 'confirmed', DISMISSED: 'discarded', INSUFFICIENT_EVIDENCE: 'insufficient' }
const API_DECISION: Record<Decision, string> = { confirmed: 'CONFIRMED', discarded: 'DISMISSED', insufficient: 'INSUFFICIENT_EVIDENCE' }

export function reviewOf(i: ApiIncident): Review | undefined {
  const decision = DECISION[i.review_status ?? '']
  if (!decision || !i.reviewed_at) return undefined
  return { decision, note: i.review_note ?? '', reviewedAt: i.reviewed_at, reviewer: i.reviewed_by ?? undefined }
}

/** Envia o parecer ao Incident. Lança erro com a mensagem do serviço se for recusado. */
export async function sendReview(incidentId: string, decision: Decision, note: string, reviewer: string): Promise<void> {
  const res = await fetch(`/api/epi/incident/incidents/${encodeURIComponent(incidentId)}/review`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...authHeader() },
    // com login, o serviço usa o usuário do token e ignora este campo
    body: JSON.stringify({ decision: API_DECISION[decision], note, ...(readSession() ? {} : { reviewer }) }),
  })
  if (res.status === 401 && readSession()) throw new AuthRequired()
  if (!res.ok) {
    let detail = `erro ${res.status}`
    try { const j = await res.json(); if (typeof j.detail === 'string') detail = j.detail } catch { /* mantém o código */ }
    throw new Error(detail)
  }
}

async function getJson<T>(url: string, withAuth = false): Promise<T> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 2500)
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: withAuth ? authHeader() : undefined })
    if (res.status === 401) throw new AuthRequired()
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

export type CameraSignal = 'ONLINE' | 'OFFLINE'
/** Estado de sinal vindo do Fusion. Lança erro se o Fusion não responder (a tela mostra "desconhecido"). */
export async function fetchCameraSignals(): Promise<Record<string, CameraSignal>> {
  const r = await getJson<{ cameras: { camera_id: string; status: CameraSignal }[] }>('/api/epi/fusion/fusion/cameras/status')
  return Object.fromEntries(r.cameras.map(c => [c.camera_id, c.status]))
}

export async function fetchLive(): Promise<LiveData> {
  const [incidents, cameras] = await Promise.all([
    getJson<ApiIncident[]>('/api/epi/incident/incidents', true),
    getJson<ApiCamera[]>('/api/epi/tracker/cameras'),
  ])
  // fila = incidentes abertos; histórico = os já revisados (mesmo que depois resolvidos)
  const shown = incidents.filter(i => i.status === 'OPEN' || reviewOf(i))
  const alerts = shown.map(i => toAlert(i, cameras))
  const reviews: Reviews = {}
  for (const i of shown) { const r = reviewOf(i); if (r) reviews[i.incident_id] = r }
  const zones: Zone[] = Object.entries(SECTORS).map(([id, s]) => ({ id, name: s.name, subtitle: s.subtitle, grid: '' }))
  if (alerts.some(a => a.zone === NO_SECTOR)) zones.push({ id: NO_SECTOR, name: 'Sem setor', subtitle: 'Câmera sem setor cadastrado', grid: '' })
  return { alerts, zones, cameras, reviews }
}

// ---- Evidência em imagem (só o recorte da pessoa; só com login) ----
export type EvidenceBox = { label: string; status?: string; bbox: [number, number, number, number]; confidence?: number }
export type EvidenceItem = { id: string; width: number; height: number; detections: EvidenceBox[]; expiresAt: string | null; purged: boolean; url: string | null }
export type EvidenceResult = { state: 'ok' | 'none' | 'forbidden' | 'unavailable'; items: EvidenceItem[] }

/** Busca a lista e cada imagem COM o cabeçalho de login (não existe URL pública). Os blobs ficam só em memória. */
export async function fetchEvidence(incidentId: string): Promise<EvidenceResult> {
  const base = `/api/epi/incident/incidents/${encodeURIComponent(incidentId)}/evidence`
  const res = await fetch(base, { headers: authHeader() })
  if (res.status === 401 && readSession()) throw new AuthRequired()
  if (res.status === 403) return { state: 'forbidden', items: [] }
  if (!res.ok) return { state: 'unavailable', items: [] }
  const rows = await res.json() as Array<{ evidence_id: string; width: number; height: number; detections: EvidenceBox[]; expires_at: string | null; purged: boolean }>
  if (!rows.length) return { state: 'none', items: [] }
  const items = await Promise.all(rows.map(async (r): Promise<EvidenceItem> => {
    let url: string | null = null
    if (!r.purged) {
      const img = await fetch(`${base}/${encodeURIComponent(r.evidence_id)}/image`, { headers: authHeader() })
      if (img.ok) url = URL.createObjectURL(await img.blob())
    }
    return { id: r.evidence_id, width: r.width, height: r.height, detections: r.detections ?? [], expiresAt: r.expires_at, purged: r.purged, url }
  }))
  return { state: 'ok', items }
}
