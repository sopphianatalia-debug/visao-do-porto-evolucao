import { useState } from 'react'
import { CircleAlert, LogIn } from 'lucide-react'

export function LoginPage({ onLogin }: { onLogin: (username: string, password: string) => Promise<string | void> }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError('')
    const problem = await onLogin(username.trim(), password)
    setBusy(false)
    if (problem) { setError(problem); setPassword('') }
  }
  return <section className="panel login-panel" aria-labelledby="login-title">
    <div className="panel-head"><div><h2 id="login-title">Entrar</h2><p>Use seu usuário e senha de operador ou supervisor.</p></div></div>
    <form onSubmit={submit} className="login-form">
      <label className="note-label" htmlFor="login-user">Usuário</label>
      <input id="login-user" className="text-input" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" autoFocus required />
      <label className="note-label" htmlFor="login-pass">Senha</label>
      <input id="login-pass" className="text-input" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
      {!!error && <div className="notice danger" role="alert"><CircleAlert size={17} />{error}</div>}
      <button className="button primary" type="submit" disabled={busy || !username || !password}><LogIn size={16} /> {busy ? 'Entrando…' : 'Entrar'}</button>
    </form>
  </section>
}
