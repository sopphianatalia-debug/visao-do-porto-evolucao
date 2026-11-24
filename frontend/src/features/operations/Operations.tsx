import { useEffect, useRef, useState } from 'react'
import { ArrowRight, ChevronRight, CircleAlert, ClipboardCheck, Clock3, Crosshair, Filter, Layers3, MapPin, ScanLine, ShieldAlert } from 'lucide-react'
import { Badge } from '../../shared/Badge'
import { Evidence, labImage } from '../analysis/Evidence'
import { useData } from './DataContext'
import { EvidenceViewer } from './EvidenceViewer'
import { roleLabel } from '../auth/session'
import { useWorker, workerLine } from './useWorker'
import { dateLabel, decisionLabels, severityLabels, type Alert, type Decision, type Review, type Reviews, type Severity } from './model'

type CamState = 'ONLINE' | 'OFFLINE' | 'SEM_DADOS' | 'DESCONHECIDO'
const camLabels: Record<CamState, [string, 'clear' | 'attention' | 'neutral']> = {
  ONLINE: ['Online', 'clear'], OFFLINE: ['Sem sinal', 'attention'], SEM_DADOS: ['Sem dados', 'neutral'], DESCONHECIDO: ['Desconhecido', 'neutral'],
}
const camState = (id: string, signals: Record<string, string>, known: boolean): CamState =>
  !known ? 'DESCONHECIDO' : signals[id] === 'ONLINE' ? 'ONLINE' : signals[id] === 'OFFLINE' ? 'OFFLINE' : 'SEM_DADOS'
const inSector = (c: { sector: string | null }, zoneId: string) => (c.sector ?? 'SEM_SETOR') === zoneId

const zoneTones = { clear: 'Sem pendência', risk: 'Crítico', watch: 'Atenção' } as const
type Pick = (alert: Alert) => void
type ZonePick = (id: string) => void
const zoneTone = (alerts: Alert[], id: string, reviews: Reviews) => {
  const pending = alerts.filter(a => a.zone === id && !reviews[a.id])
  return pending.some(a => a.severity === 'critical') ? 'risk' : pending.length ? 'watch' : 'clear'
}

export function AlertRows({ rows, reviews, onOpen }: { rows: Alert[]; reviews: Reviews; onOpen: Pick }) {
  const { zoneName } = useData()
  if (!rows.length) return <div className="empty"><ClipboardCheck size={28} /><strong>Nenhum alerta encontrado</strong><span>Altere os filtros ou volte à visão geral.</span></div>
  return <ul className="alert-rows">{rows.map(a => <li key={a.id}>
    <button className="alert-row" onClick={() => onOpen(a)}>
      <span className="alert-row-text"><strong>{a.title}</strong><small>{zoneName(a.zone)} <b>·</b> {reviews[a.id] ? decisionLabels[reviews[a.id].decision] : a.id}</small></span>
      <span className="row-severity"><Badge tone={a.severity}>{severityLabels[a.severity]}</Badge></span><time className="row-time">{a.time}</time>
      <ChevronRight size={16} className="chevron" />
    </button>
  </li>)}</ul>
}

export function LabMap({ onZone, selected, reviews }: { onZone: ZonePick; selected?: string; reviews: Reviews }) {
  const { alerts, zones, mode, cameras, signals, signalsKnown } = useData()
  const live = mode === 'live'
  const camLine = (zoneId: string) => {
    const cams = cameras.filter(c => c.active && inSector(c, zoneId))
    if (!live || !cams.length) return ''
    if (!signalsKnown) return `${cams.length} câmera${cams.length > 1 ? 's' : ''}`
    return `${cams.filter(c => camState(c.camera_id, signals, true) === 'ONLINE').length}/${cams.length} câmeras online`
  }
  return <>
    <div className={live ? 'sector-grid' : 'map-layout'} aria-label={live ? 'Setores do porto' : 'Mapa ilustrativo com quatro zonas do laboratório'}>
      <div className="map-caption"><span>{live ? 'SETORES DO PORTO' : 'PLANTA ESQUEMÁTICA'}</span><span>{live ? 'AO VIVO' : 'LAB-01'} <Crosshair size={14} /></span></div>
      {zones.map((z, i) => <button key={z.id} className={`zone zone-${zoneTone(alerts, z.id, reviews)} ${live ? '' : 'map-' + z.grid}`} onClick={() => onZone(z.id)} aria-pressed={selected === z.id}>
        <span className="zone-code">{live ? 'S0' : 'Z0'}{i + 1}<i aria-hidden="true" /></span><strong>{z.name}</strong><small>{z.subtitle}</small>{camLine(z.id) && <small>{camLine(z.id)}</small>}<span className="sr-only">{zoneTones[zoneTone(alerts, z.id, reviews)]}</span>
      </button>)}
    </div>
    <div className="map-legend"><span>ESTADO DAS ZONAS</span><Badge tone="clear">Sem pendência</Badge><Badge tone="attention">Atenção</Badge><Badge tone="critical">Crítico</Badge></div>
  </>
}

export function Dashboard({ reviews, onOpen, onZone, onNavigate }: {
  reviews: Reviews; onOpen: Pick; onZone: ZonePick; onNavigate: (route: string) => void
}) {
  const { alerts, mode } = useData()
  const live = mode === 'live'
  const pending = alerts.filter(a => !reviews[a.id])
  const critical = pending.filter(a => a.severity === 'critical').length
  return <>
    <header className="page-intro dashboard-intro">
      <div><h1>Visão geral</h1><p>{live ? 'Monitoramento e revisão de ocorrências do porto, com dados dos serviços.' : 'Monitoramento e revisão de ocorrências no laboratório.'}</p></div>
      <button className="button primary" onClick={() => onNavigate('analisar')}><ScanLine size={17} /> Analisar imagem</button>
    </header>
    <section className="status-strip" aria-label="Resumo da operação">
      <div><span>Pendentes de revisão</span><strong>{pending.length}</strong></div>
      <div><span>Alertas críticos</span><strong>{critical}</strong></div>
      <div><span>Revisados</span><strong>{alerts.length - pending.length}</strong></div>
    </section>
    <div className="board dashboard-board">
      <section className="panel queue-panel">
        <div className="panel-head"><div><h2>Fila de alertas</h2><p>Selecione uma ocorrência para conferir a evidência.</p></div></div>
        {pending.length > 0 && <div className="queue-columns" aria-hidden="true"><span>Ocorrência</span><span>Gravidade</span><span>Hora</span></div>}
        <AlertRows rows={pending} reviews={reviews} onOpen={onOpen} />
        <div className="panel-footer"><button className="text-button" onClick={() => onNavigate('alertas')}>Ver todos os alertas <ArrowRight size={15} /></button></div>
      </section>
      <section className="panel map-panel">
        <div className="panel-head"><div><h2>{live ? 'Setores do porto' : 'Zonas do laboratório'}</h2><p>Selecione uma área para filtrar a fila.</p></div><MapPin size={18} className="panel-symbol" aria-hidden="true" /></div>
        <LabMap onZone={onZone} reviews={reviews} />
      </section>
    </div>
    <p className="simulation-note"><CircleAlert size={16} aria-hidden="true" /> {live ? 'Dados ao vivo dos serviços EPI Vision (Incident e Tracker). A revisão é registrada no serviço de incidentes.' : 'Os alertas e a planta são ilustrativos. Nenhum serviço está conectado.'}</p>
  </>
}

export function AlertsPage({ zone, reviews, onOpen }: { zone: string; reviews: Reviews; onOpen: Pick }) {
  const { alerts, zones, mode } = useData()
  const [severity, setSeverity] = useState<Severity | ''>('')
  const [selectedZone, setSelectedZone] = useState(zone)
  const [showReviewed, setShowReviewed] = useState(false)
  const rows = alerts.filter(a => (!severity || a.severity === severity) && (!selectedZone || a.zone === selectedZone) && (showReviewed || !reviews[a.id]))
  return <>
    <header className="page-intro"><div className="eyebrow"><ShieldAlert size={17} /> OPERAÇÃO</div><h1>Alertas</h1><p>{mode === 'live' ? 'Confira a regra e a câmera de cada incidente aberto.' : 'Confira a regra e a evidência de cada ocorrência simulada.'}</p></header>
    <section className="panel">
      <div className="panel-head"><div><h2>Fila de revisão</h2><p>{rows.length} {rows.length === 1 ? 'resultado' : 'resultados'}</p></div><Badge tone="cyan">{mode === 'live' ? 'Ao vivo' : 'Dados simulados'}</Badge></div>
      <div className="filters"><Filter size={17} aria-hidden="true" />
        <label>Gravidade<select aria-label="Gravidade" value={severity} onChange={e => setSeverity(e.target.value as Severity | '')}><option value="">Todas</option><option value="critical">Crítico</option><option value="attention">Atenção</option></select></label>
        <label>Zona<select aria-label="Zona" value={selectedZone} onChange={e => setSelectedZone(e.target.value)}><option value="">Todas</option>{zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}</select></label>
        <label className="checkbox"><input type="checkbox" checked={showReviewed} onChange={e => setShowReviewed(e.target.checked)} /> Incluir revisados</label>
      </div>
      <AlertRows rows={rows} reviews={reviews} onOpen={onOpen} />
    </section>
  </>
}

export function ZonesPage({ onZone, reviews }: { onZone: ZonePick; reviews: Reviews }) {
  const { alerts, zones, mode, cameras, signals, signalsKnown } = useData()
  const live = mode === 'live'
  const [selected, setSelected] = useState(zones[0].id)
  const z = zones.find(v => v.id === selected) ?? zones[0]
  const tone = zoneTone(alerts, z.id, reviews)
  return <>
    <header className="page-intro"><div className="eyebrow"><Layers3 size={17} /> CONFIGURAÇÃO</div><h1>Zonas</h1><p>{live ? 'Setores do porto com os incidentes abertos. O mapa geográfico e os limites de cada setor ainda dependem de dados externos.' : 'Planta ilustrativa do piloto. A edição de polígonos e a avaliação de regras ainda não estão ligadas ao backend.'}</p></header>
    <div className="board"><section className="panel map-panel"><div className="panel-head"><div><h2>{live ? 'Setores' : 'Mapa do laboratório'}</h2><p>Selecione uma área para ver os incidentes.</p></div><Badge tone="cyan">{live ? 'Ao vivo' : 'Simulação'}</Badge></div><LabMap selected={selected} onZone={setSelected} reviews={reviews} /></section>
    <section className="panel zone-info"><div className="panel-head"><h2>Detalhe da zona</h2><MapPin size={18} /></div><div className="zone-detail"><Badge tone={tone === 'risk' ? 'critical' : tone === 'watch' ? 'attention' : 'clear'}>{zoneTones[tone]}</Badge><h3>{z.name}</h3><p>{z.subtitle}{live ? '' : ' · LAB-01'}</p><button className="button secondary" onClick={() => onZone(z.id)}>Ver alertas da zona <ArrowRight size={17} /></button>
      {live && <div className="zone-cameras"><h4>Câmeras</h4>
        {cameras.filter(c => c.active && inSector(c, z.id)).length === 0 ? <p>Nenhuma câmera cadastrada neste setor.</p> :
          <ul>{cameras.filter(c => c.active && inSector(c, z.id)).map(c => { const [label, tone] = camLabels[camState(c.camera_id, signals, signalsKnown)]; return <li key={c.camera_id}><span>{c.name} <small>({c.camera_id})</small></span><Badge tone={tone}>{label}</Badge></li> })}</ul>}
        <small>{signalsKnown ? 'Sem sinal significa que a câmera parou de enviar dados; não indica violação.' : 'Não foi possível ler o estado das câmeras (Fusion indisponível).'}</small></div>}
      </div></section></div>
  </>
}

export function HistoryPage({ reviews, onOpen }: { reviews: Reviews; onOpen: Pick }) {
  const { alerts } = useData()
  const reviewed = alerts.filter(a => !!reviews[a.id]).sort((a, b) => reviews[b.id].reviewedAt.localeCompare(reviews[a.id].reviewedAt))
  return <>
    <header className="page-intro"><div className="eyebrow"><Clock3 size={17} /> ACOMPANHAMENTO</div><h1>Histórico</h1><p>Decisões desta demonstração, armazenadas apenas neste navegador.</p></header>
    <section className="panel"><div className="panel-head"><div><h2>Alertas revisados</h2><p>Abra uma revisão para ver a decisão e a justificativa.</p></div><Badge>{reviewed.length} {reviewed.length === 1 ? 'registro' : 'registros'}</Badge></div>
    <AlertRows rows={reviewed} reviews={reviews} onOpen={onOpen} /></section>
  </>
}

export function ReviewDialog({ alert, review, onClose, onSave }: { alert: Alert; review?: Review; onClose: () => void; onSave: (id: string, review: Review) => Promise<string | void> | string | void }) {
  const { zoneName, mode, session } = useData()
  const live = mode === 'live'
  const readOnly = live && session?.role === 'OPERADOR'   // quem decide é o supervisor
  const worker = useWorker(alert.employee, live && session?.role === 'SUPERVISOR')   // nome/cargo/setor só para o supervisor
  const dialog = useRef<HTMLDialogElement>(null)
  const noteField = useRef<HTMLTextAreaElement>(null)
  const [note, setNote] = useState(review?.note ?? '')
  const [reviewer, setReviewer] = useState(() => { try { return localStorage.getItem('visao-do-porto.reviewer') ?? '' } catch { return '' } })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const node = dialog.current
    const previousFocus = document.activeElement
    node?.showModal()
    return () => {
      node?.close()
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
      else document.getElementById('main-content')?.focus()
    }
  }, [])

  async function save(decision: Decision) {
    if (!note.trim()) { setError('Adicione uma justificativa para registrar a decisão.'); noteField.current?.focus(); return }
    if (live && !session && !reviewer.trim()) { setError('Informe o nome do revisor.'); return }
    setSaving(true)
    const problem = await onSave(alert.id, { decision, note: note.trim(), reviewedAt: new Date().toISOString(), reviewer: session ? session.username : (reviewer.trim() || undefined) })
    setSaving(false)
    if (problem) { setError(problem); return }
    try { if (reviewer.trim()) localStorage.setItem('visao-do-porto.reviewer', reviewer.trim()) } catch { /* sem armazenamento */ }
    onClose()
  }

  return <dialog ref={dialog} className="review-dialog" aria-labelledby="review-title" onCancel={onClose}>
    <div className="review-header">
      <div><span className="eyebrow">{alert.id} · {live ? 'INCIDENTE' : 'ALERTA SIMULADO'}</span><h2 id="review-title">{alert.title}</h2></div>
      <button className="icon-button" onClick={onClose} aria-label="Fechar detalhes" autoFocus>×</button>
    </div>
    <div className="review-body">
      <div className="review-meta"><Badge tone={alert.severity}>{severityLabels[alert.severity]}</Badge><span>{alert.type}</span></div>
      {live ? (session ? <EvidenceViewer incidentId={alert.id} /> : <p className="image-caption">A evidência em imagem só aparece com login. Confira a câmera de origem.</p>) : <>
      <Evidence src={labImage} width={960} height={540} alt="Imagem ilustrativa do cenário, não corresponde a uma ocorrência real" zone={alert.zone === 'z2'} />
      <p className="image-caption">Cena ilustrativa. Não é uma evidência de ocorrência real.</p></>}
      <dl className="review-facts"><div><dt>Zona</dt><dd>{zoneName(alert.zone)}</dd></div><div><dt>Fonte</dt><dd>{alert.camera}</dd></div>{live && <div><dt>Trabalhador</dt><dd>{workerLine(worker, alert.employee)}</dd></div>}<div><dt>Registro</dt><dd>{live ? new Date().toLocaleDateString('pt-BR') : dateLabel} · {alert.time}</dd></div></dl>
      <div className="rule-box"><strong>{alert.rule}</strong><p>{alert.reason}</p></div>
      {readOnly && !review && <p className="reviewer-line" data-testid="operator-note"><strong>Somente leitura.</strong></p>}
      {review ? <div className="saved-review"><Badge tone={review.decision === 'confirmed' ? 'clear' : 'neutral'}>{decisionLabels[review.decision]}</Badge><p>{review.note}</p><small>{new Date(review.reviewedAt).toLocaleString('pt-BR')}{review.reviewer ? ` · ${review.reviewer}` : ''} · {live ? 'Registrado no serviço de incidentes' : 'Registro local de demonstração'}</small></div> :
        <>{readOnly ? null : session
          ? <p className="reviewer-line"><strong>Revisor:</strong> {session.name} <small>({roleLabel[session.role]})</small></p>
          : <><label className="note-label" htmlFor="review-reviewer">Revisor</label><input id="review-reviewer" className="text-input" value={reviewer} onChange={e => { setReviewer(e.target.value); setError('') }} maxLength={80} placeholder="Seu nome" autoComplete="name" /></>}
        {!readOnly && <><label className="note-label" htmlFor="review-note">Justificativa da revisão</label><textarea ref={noteField} id="review-note" value={note} onChange={e => { setNote(e.target.value); setError('') }} aria-invalid={!!error} aria-describedby={error ? 'review-error' : undefined} maxLength={500} rows={3} placeholder="O que você observou na evidência?" /></>}
        {!!error && <div className="notice danger" role="alert" id="review-error"><CircleAlert size={17} />{error}</div>}</>}
    </div>
    {!review && !readOnly && <div className="review-footer"><button className="button primary" disabled={saving} onClick={() => save('confirmed')}>Confirmar</button><button className="button secondary" disabled={saving} onClick={() => save('discarded')}>Descartar</button><button className="button secondary" disabled={saving} onClick={() => save('insufficient')}>Evidência insuficiente</button></div>}
  </dialog>
}
