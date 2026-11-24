import { useEffect, useState } from 'react'
import { authHeader } from '../auth/session'
import { SECTORS } from './live'

export type Worker = { code: string; name: string; role: string | null; sector: string | null }

// Cache só em memória (some ao recarregar a página): o nome vem do cadastro, não é guardado no navegador.
const cache = new Map<string, Promise<Worker | null>>()

async function load(code: string): Promise<Worker | null> {
  try {
    const res = await fetch(`/api/epi/incident/workers/${encodeURIComponent(code)}`, { headers: authHeader() })
    if (!res.ok) return null                       // 403, 404 ou cadastro fora do ar: a tela segue só com o código
    const r = await res.json() as { employee_code: string; name: string; role_title?: string; sector?: string }
    return { code: r.employee_code, name: r.name, role: r.role_title ?? null, sector: r.sector ?? null }
  } catch { return null }
}

/** Nome, cargo e setor do trabalhador, só para o supervisor. Sem permissão ou sem cadastro, devolve null. */
export function useWorker(code: string | undefined, enabled: boolean): Worker | null {
  const [worker, setWorker] = useState<Worker | null>(null)
  useEffect(() => {
    setWorker(null)
    if (!enabled || !code) return
    let alive = true
    let p = cache.get(code)
    if (!p) { p = load(code); cache.set(code, p) }
    void p.then(w => { if (alive) setWorker(w); if (!w) cache.delete(code) })   // falha não fica em cache
    return () => { alive = false }
  }, [code, enabled])
  return worker
}

export const sectorLabel = (s: string | null) => (s ? SECTORS[s]?.name ?? s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase()) : null)

/** "Maria Souza · Operadora · Cais 2 (FUNC-000001)"; sem cadastro, só o código. */
export function workerLine(w: Worker | null, code: string | undefined): string {
  if (!code) return 'Não identificado'
  if (!w) return code
  return [w.name, w.role, sectorLabel(w.sector)].filter(Boolean).join(' · ') + ` (${code})`
}
