import { useEffect, useState } from 'react'
import { Activity, ChevronRight, History, LayoutDashboard, Map, ScanLine, ShieldAlert } from 'lucide-react'
import { AnalysisPage } from '../features/analysis/AnalysisPage'
import { AlertsPage, Dashboard, HistoryPage, ReviewDialog, ZonesPage } from '../features/operations/Operations'
import { DataGate, DataProvider, useData } from '../features/operations/DataContext'
import { sendReview } from '../features/operations/live'
import { readReviews, reviewKey, type Alert, type Review } from '../features/operations/model'

const pages = [
  { id: 'painel', label: 'Visão geral', Icon: LayoutDashboard },
  { id: 'analisar', label: 'Analisar imagem', Icon: ScanLine },
  { id: 'alertas', label: 'Alertas', Icon: ShieldAlert },
  { id: 'zonas', label: 'Zonas', Icon: Map },
  { id: 'historico', label: 'Histórico', Icon: History },
] as const
const readRoute = () => {
  const [path, query] = location.hash.slice(1).split('?')
  return { page: pages.find(p => p.id === path) ?? pages[0], zone: new URLSearchParams(query).get('zona') ?? '' }
}
const goTo = (id: string) => { location.hash = id }
const goToZone = (id: string) => { goTo('alertas?zona=' + encodeURIComponent(id)) }

export function App() {
  return <DataProvider><Shell /></DataProvider>
}

function Shell() {
  const { mode, reviews: serviceReviews, refresh } = useData()
  const live = mode === 'live'
  const [{ page, zone }, setRoute] = useState(readRoute)
  const [localReviews, setReviews] = useState(readReviews)
  const reviews = live ? serviceReviews : localReviews
  const [active, setActive] = useState<Alert | null>(null)
  const [feedback, setFeedback] = useState('')
  useEffect(() => {
    const handler = () => { setRoute(readRoute()); setActive(null); setFeedback(''); window.scrollTo(0, 0); requestAnimationFrame(() => document.getElementById('main-content')?.focus()) }
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  async function save(id: string, review: Review): Promise<string | void> {
    if (live) {
      // ao vivo: a decisão vai para o serviço de incidentes (guardada com revisor e horário)
      try { await sendReview(id, review.decision, review.note, review.reviewer ?? '') }
      catch (e) { return `Não foi possível registrar no serviço: ${e instanceof Error ? e.message : 'erro desconhecido'}` }
      refresh()
      setFeedback('Revisão registrada no serviço de incidentes.')
      return
    }
    const next = { ...localReviews, [id]: review }
    setReviews(next)
    try { localStorage.setItem(reviewKey, JSON.stringify(next)); setFeedback('Revisão registrada neste navegador.') }
    catch { setFeedback('Revisão registrada apenas nesta sessão. Não foi possível salvar no navegador.') }
  }

  return <div className="shell">
    <a className="skip" href="#main-content" onClick={e => { e.preventDefault(); document.getElementById('main-content')?.focus() }}>Pular para o conteúdo</a>
    <aside className="sidebar">
      <a className="brand" href="#painel"><img src={import.meta.env.BASE_URL + 'porto.svg'} alt="" /><span><strong>Visão do Porto</strong><small>Central de operações</small></span></a>
      <p className="nav-label">OPERAÇÃO</p>
      <nav aria-label="Navegação principal">{pages.map(({ id, label, Icon }) => <a href={'#' + id} key={id} aria-current={page.id === id ? 'page' : undefined}><Icon size={18} /><span>{label}</span>{page.id === id && <ChevronRight className="nav-arrow" size={15} />}</a>)}</nav>
      <div className="sidebar-bottom"><div className="sandbox-mark"><span className="site-indicator" aria-hidden="true" /><span><strong>Laboratório UNDB</strong><small>Piloto acadêmico</small></span></div></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="breadcrumb"><span>Operação</span><ChevronRight size={14} /><strong>{page.label}</strong></div><span className="environment-label"><i aria-hidden="true" /> Ambiente de demonstração</span></header>
      <main className="content" tabIndex={-1} id="main-content">
        {page.id === 'painel' && <DataGate><Dashboard reviews={reviews} onOpen={setActive} onZone={goToZone} onNavigate={goTo} /></DataGate>}
        {page.id === 'analisar' && <AnalysisPage />}
        {page.id === 'alertas' && <DataGate><AlertsPage key={zone} zone={zone} reviews={reviews} onOpen={setActive} /></DataGate>}
        {page.id === 'zonas' && <DataGate><ZonesPage onZone={goToZone} reviews={reviews} /></DataGate>}
        {page.id === 'historico' && <DataGate><HistoryPage reviews={reviews} onOpen={setActive} /></DataGate>}
        <div className="footer"><Activity size={14} /> Visão do Porto <span>·</span> Piloto de segurança assistida</div>
      </main>
    </div>
    {active && <ReviewDialog key={active.id} alert={active} review={reviews[active.id]} onClose={() => setActive(null)} onSave={save} />}
    <div className={feedback ? 'toast' : 'sr-only'} aria-live="polite">{feedback}</div>
  </div>
}
