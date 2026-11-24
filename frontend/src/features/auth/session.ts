// Sessão de login. O token fica no sessionStorage (some ao fechar a aba) — nunca no localStorage.
export type Role = 'OPERADOR' | 'SUPERVISOR'
export type Session = { token: string; username: string; name: string; role: Role }

const KEY = 'visao-do-porto.session.v1'
export const roleLabel: Record<Role, string> = { OPERADOR: 'Operador', SUPERVISOR: 'Supervisor' }

export class AuthRequired extends Error { constructor() { super('Entre com usuário e senha.') } }

export function readSession(): Session | null {
  try {
    const raw = JSON.parse(sessionStorage.getItem(KEY) ?? 'null')
    if (raw && typeof raw.token === 'string' && typeof raw.username === 'string' && (raw.role === 'OPERADOR' || raw.role === 'SUPERVISOR')) return raw as Session
  } catch { /* sem armazenamento */ }
  return null
}
export function saveSession(s: Session) { try { sessionStorage.setItem(KEY, JSON.stringify(s)) } catch { /* só em memória */ } }
export function clearSession() { try { sessionStorage.removeItem(KEY) } catch { /* nada */ } }
export const authHeader = (): Record<string, string> => { const s = readSession(); return s ? { Authorization: `Bearer ${s.token}` } : {} }

export async function loginRequest(username: string, password: string): Promise<Session> {
  let res: Response
  try {
    res = await fetch('/api/epi/auth/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password }) })
  } catch { throw new Error('Serviço de login indisponível. Verifique se o epi_auth está ligado.') }
  if (!res.ok) {
    let detail = res.status === 401 ? 'Usuário ou senha inválidos.' : `Erro ${res.status} ao entrar.`
    try { const j = await res.json(); if (typeof j.detail === 'string') detail = j.detail } catch { /* mantém */ }
    throw new Error(detail)
  }
  const j = await res.json()
  return { token: j.access_token, username: j.user.username, name: j.user.name, role: j.user.role }
}
