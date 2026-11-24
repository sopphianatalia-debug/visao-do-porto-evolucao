import { useEffect, useState } from 'react'
import { Badge } from '../../shared/Badge'
import { fetchEvidence, type EvidenceResult } from './live'

const ppeNames: Record<string, string> = { helmet: 'Capacete', vest: 'Colete', gloves: 'Luvas', boots: 'Botas', glasses: 'Óculos', person: 'Pessoa' }
const findingText = { PRESENT: 'presente', MISSING: 'ausente', NOT_VISIBLE: 'não visível' } as const
const findingClass = { PRESENT: 'clear', MISSING: 'critical', NOT_VISIBLE: 'neutral' } as const

/** Mostra o recorte da pessoa guardado pelo serviço; as caixas são desenhadas por cima, a imagem não é alterada. */
export function EvidenceViewer({ incidentId }: { incidentId: string }) {
  const [res, setRes] = useState<EvidenceResult | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    let urls: string[] = []
    fetchEvidence(incidentId).then(r => { if (alive) { urls = r.items.flatMap(i => i.url ? [i.url] : []); setRes(r) } else r.items.forEach(i => i.url && URL.revokeObjectURL(i.url)) })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false; urls.forEach(u => URL.revokeObjectURL(u)) }
  }, [incidentId])

  if (failed) return <p className="image-caption" data-testid="evidence-state">Não foi possível carregar a imagem de evidência agora. Confira a câmera de origem.</p>
  if (!res) return <p className="image-caption" data-testid="evidence-state">Carregando evidência…</p>
  if (res.state === 'forbidden') return <p className="image-caption" data-testid="evidence-state">Este incidente já foi revisado por outra pessoa; só o supervisor vê a imagem.</p>
  if (res.state === 'unavailable') return <p className="image-caption" data-testid="evidence-state">A evidência em imagem não está ativa no serviço. Confira a câmera de origem.</p>
  if (res.state === 'none') return <p className="image-caption" data-testid="evidence-state">Nenhuma imagem foi guardada para este incidente. Confira a câmera de origem.</p>
  return <div data-testid="evidence-viewer">{res.items.map(it => it.purged || !it.url
    ? <p key={it.id} className="image-caption" data-testid="evidence-state">Imagem apagada pelo prazo de retenção.</p>
    : <figure key={it.id} className="evidence-figure">
        <div className="evidence" style={{ aspectRatio: `${it.width} / ${it.height}`, maxHeight: 420, margin: '0 auto' }}>
          <img src={it.url} alt="Recorte da pessoa no momento do incidente" />
          <svg viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
            {it.detections.map((d, k) => <rect key={k} x={d.bbox[0]} y={d.bbox[1]} width={d.bbox[2]} height={d.bbox[3]} fill="none" vectorEffect="non-scaling-stroke"
              stroke={d.label === 'person' ? '#9fb3c8' : d.status === 'MISSING' ? '#ff6b6b' : '#5ad19a'} strokeWidth={2} strokeDasharray={d.label === 'person' ? '6 4' : undefined} />)}
          </svg>
        </div>
        {it.findings.length > 0 && <ul className="evidence-findings" aria-label="O que o sistema concluiu para cada equipamento" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
          {it.findings.map(f => <li key={f.label}><Badge tone={findingClass[f.status]}>{ppeNames[f.label] ?? f.label} {findingText[f.status]}</Badge></li>)}</ul>}
        <figcaption className="image-caption">Somente o recorte da pessoa. O contorno tracejado é a pessoa avaliada; um equipamento ausente não tem posição na imagem.
          {it.expiresAt ? ` · guardada até ${new Date(it.expiresAt).toLocaleDateString('pt-BR')}` : ''}</figcaption>
      </figure>)}</div>
}
