import { expect, test, type Page } from '@playwright/test'
import { parseAnalysis } from '../src/features/analysis/api'
import { resolve } from 'node:path'

test.beforeEach(async ({ page }) => {
  // Modo demo (dados de exemplo) só para os testes antigos; os novos limpam isso.
  await page.addInitScript(() => { if (!sessionStorage.getItem('sem-demo')) localStorage.setItem('visao-do-porto.demo', '1') })
})

const endpoint = '**/api/v1/vision/analyze'
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aTKUAAAAASUVORK5CYII=', 'base64')
const input = async (page: Page) => {
  await page.goto('/#analisar')
  await page.getByLabel('Selecionar imagem').setInputFiles({ name: 'quadro.png', mimeType: 'image/png', buffer: png })
}
const validated = { filename: 'quadro.png', width: 1, height: 1, status: 'VALIDATED', inference_performed: false, detections: [], message: 'Imagem validada.' }
const hit = { ...validated, status: 'ANALYZED', inference_performed: true, detections: [{ class_id: 0, class_name: 'person', confidence: .8246, bbox: { x1: .1, y1: .1, x2: .8, y2: .8 } }] }

test('mapa abre a fila já filtrada, sem rota morta', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible()
  await page.getByRole('button', { name: /^Z02 Equipamentos/i }).click()
  await expect(page.getByLabel('Zona', { exact: true })).toHaveValue('z2')
  await expect(page.getByRole('button', { name: /entrada em área restrita/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /capacete não detectado/i })).toHaveCount(0)
  await page.getByLabel('Gravidade').selectOption('attention')
  await expect(page.getByText('Nenhum alerta encontrado')).toBeVisible()
})

test('revisão exige justificativa e permanece no histórico após recarregar', async ({ page }) => {
  await page.goto('/#alertas')
  await page.getByRole('button', { name: /entrada em área restrita/i }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Confirmar', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('justificativa')
  await dialog.getByLabel('Justificativa da revisão').fill('A imagem é ilustrativa e não confirma ocorrência.')
  await dialog.getByRole('button', { name: 'Evidência insuficiente', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByRole('button', { name: /entrada em área restrita/i })).toHaveCount(0)
  await page.getByRole('link', { name: 'Visão geral' }).click()
  await expect(page.getByRole('button', { name: /^Z02 Equipamentos.*Sem pendência/i })).toBeVisible()
  await page.getByRole('link', { name: 'Histórico' }).click()
  await page.reload()
  await page.getByRole('button', { name: /entrada em área restrita/i }).click()
  await expect(dialog.getByText('Evidência insuficiente', { exact: true })).toBeVisible()
  await expect(dialog.getByText('A imagem é ilustrativa e não confirma ocorrência.')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
})

test('exemplo não faz POST e é explicitamente simulado', async ({ page }) => {
  let posts = 0
  await page.route(endpoint, async route => { posts++; await route.abort() })
  await page.goto('/#analisar')
  await page.getByRole('button', { name: 'Usar exemplo' }).click()
  await expect(page.getByText('Detecções fictícias. Nenhuma inferência foi executada.')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Detecções' })).toContainText('92%')
  expect(posts).toBe(0)
})

test('FastAPI 0.2 por contrato: envia multipart e exibe validação sem inferência', async ({ page }) => {
  await page.route(endpoint, async route => {
    expect(route.request().method()).toBe('POST')
    expect(route.request().headers()['content-type']).toContain('multipart/form-data; boundary=')
    expect(route.request().postData()).toContain('name="file"')
    await route.fulfill({ json: validated })
  })
  await input(page)
  await page.getByRole('button', { name: 'Enviar para análise' }).click()
  await expect(page.getByText('Imagem validada. A API ainda não executou inferência.')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Detecções' })).toHaveCount(0)
})

test('contrato de inferência: desenha caixa SVG e mostra a confiança', async ({ page }) => {
  await page.route(endpoint, route => route.fulfill({ json: hit }))
  await input(page)
  await page.getByRole('button', { name: 'Enviar para análise' }).click()
  await expect(page.getByText('Análise concluída. 1 detecção.')).toBeVisible()
  await expect(page.locator('.detect-box')).toHaveAttribute('x', '0.1')
  await expect(page.getByRole('list', { name: 'Detecções' })).toContainText('82,46%')
})

test('zero detecções não é tratado como falha', async ({ page }) => {
  await page.route(endpoint, route => route.fulfill({ json: { ...hit, detections: [] } }))
  await input(page)
  await page.getByRole('button', { name: 'Enviar para análise' }).click()
  await expect(page.getByText('Análise concluída. Nenhuma pessoa detectada.')).toBeVisible()
})

test('falhas HTTP e arquivos inválidos ficam visíveis ao usuário', async ({ page }) => {
  await page.route(endpoint, route => route.fulfill({ status: 422, json: { detail: 'Arquivo de imagem inválido ou corrompido.' } }))
  await input(page)
  await page.getByRole('button', { name: 'Enviar para análise' }).click()
  await expect(page.getByRole('alert')).toContainText('corrompido')
  await page.getByLabel('Selecionar imagem').setInputFiles({ name: 'arquivo.txt', mimeType: 'text/plain', buffer: Buffer.from('x') })
  await expect(page.getByRole('alert')).toContainText('Formato não suportado')
  await expect(page.getByRole('button', { name: 'Enviar para análise' })).toBeDisabled()
})

test('resposta inválida não é interpretada como detecção', () => {
  expect(() => parseAnalysis({ ...hit, width: 0 })).toThrow('Resposta inesperada')
  expect(() => parseAnalysis({ ...validated, detections: hit.detections })).toThrow('Resposta inesperada')
  expect(() => parseAnalysis({ ...hit, detections: [{ ...hit.detections[0], bbox: { ...hit.detections[0].bbox, x2: 4 } }] })).toThrow('Resposta inesperada')
})

test('painel funciona em 390 px sem rolagem horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible()
  expect(await page.locator('body').evaluate(el => el.scrollWidth)).toBeLessThanOrEqual(390)
  await page.getByRole('button', { name: /entrada em área restrita/i }).click()
  await expect(page.getByRole('button', { name: 'Fechar detalhes' })).toBeVisible()
})

test('envia um PNG real para a FastAPI quando o teste de integração é habilitado', async ({ page }) => {
  test.skip(!process.env.VISION_API_SMOKE_IMAGE, 'Requer FastAPI v0.2.0 e VISION_API_SMOKE_IMAGE')
  await page.goto('/#analisar')
  await page.getByLabel('Selecionar imagem').setInputFiles(resolve(process.env.VISION_API_SMOKE_IMAGE!))
  await page.getByRole('button', { name: 'Enviar para análise' }).click()
  await expect(page.getByText('Imagem validada. A API ainda não executou inferência.')).toBeVisible()
})

test('com os serviços EPI Vision no ar, mostra incidentes e setores reais', async ({ page }) => {
  await page.addInitScript(() => { sessionStorage.setItem('sem-demo', '1'); localStorage.removeItem('visao-do-porto.demo') })
  await page.route('**/api/epi/incident/incidents*', r => r.fulfill({ json: [
    { incident_id: 'INC-000001', ppe_type: 'helmet', severity: 'HIGH', status: 'OPEN', reason: 'helmet obrigatório e ausente',
      rule_id: 'RULE-PATIO-CARGA-001', opened_at: '2026-11-23T14:32:00-03:00', duration_seconds: 42, source_cameras: ['CAM-PIER-01'], employee_id: 'FUNC-1' }] }))
  await page.route('**/api/epi/tracker/cameras', r => r.fulfill({ json: [
    { camera_id: 'CAM-PIER-01', name: 'Píer 1', sector: 'PIER_BORDO', kind: 'INTERNA', active: true }] }))
  await page.goto('/#alertas')
  await expect(page.getByText('Ao vivo').first()).toBeVisible()
  await expect(page.getByRole('button', { name: /EPI ausente: capacete/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /EPI ausente: capacete.*Píer e bordo/i })).toBeVisible()
  await page.getByLabel('Zona', { exact: true }).selectOption('PIER_BORDO')
  await expect(page.getByRole('button', { name: /EPI ausente: capacete/i })).toBeVisible()
  await page.goto('/#zonas')
  await expect(page.getByRole('button', { name: /Guarda portuária/i })).toBeVisible()
})

test('sem serviços, mostra "serviços indisponíveis" e nenhum dado de exemplo', async ({ page }) => {
  await page.addInitScript(() => { sessionStorage.setItem('sem-demo', '1'); localStorage.removeItem('visao-do-porto.demo') })
  await page.route('**/api/epi/**', r => r.abort())
  await page.goto('/#alertas')
  await expect(page.getByRole('heading', { name: 'Serviços indisponíveis' })).toBeVisible()
  await expect(page.getByText(/Entrada em área restrita/i)).toHaveCount(0)
  await page.goto('/#painel')
  await expect(page.getByRole('heading', { name: 'Serviços indisponíveis' })).toBeVisible()
})

test('revisão ao vivo vai para o serviço, exige revisor e aparece no histórico', async ({ page }) => {
  await page.addInitScript(() => { sessionStorage.setItem('sem-demo', '1'); localStorage.removeItem('visao-do-porto.demo') })
  let reviewed: Record<string, unknown> | null = null
  const incident = () => ({ incident_id: 'INC-000001', ppe_type: 'helmet', severity: 'HIGH', status: 'OPEN', reason: 'helmet ausente',
    rule_id: 'RULE-1', opened_at: '2026-11-23T14:32:00-03:00', duration_seconds: 5, source_cameras: ['CAM-PIER-01'], employee_id: 'F1',
    ...(reviewed ? { review_status: 'CONFIRMED', reviewed_by: reviewed.reviewer, review_note: reviewed.note, reviewed_at: '2026-11-23T14:40:00-03:00' } : { review_status: 'PENDING' }) })
  await page.route('**/api/epi/incident/incidents', r => r.fulfill({ json: [incident()] }))
  await page.route('**/api/epi/incident/incidents/INC-000001/review', async r => {
    reviewed = r.request().postDataJSON()
    await r.fulfill({ json: incident() })
  })
  await page.route('**/api/epi/tracker/cameras', r => r.fulfill({ json: [{ camera_id: 'CAM-PIER-01', name: 'Píer 1', sector: 'PIER_BORDO', kind: 'INTERNA', active: true }] }))
  await page.goto('/#alertas')
  await page.getByRole('button', { name: /EPI ausente: capacete/i }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Justificativa da revisão').fill('Sem capacete no vídeo.')
  await dialog.getByRole('button', { name: 'Confirmar', exact: true }).click()
  await expect(dialog.getByText('Informe o nome do revisor.')).toBeVisible()
  await dialog.getByLabel('Revisor').fill('op.maria')
  await dialog.getByRole('button', { name: 'Confirmar', exact: true }).click()
  await expect(dialog).toBeHidden()
  expect(reviewed).toMatchObject({ decision: 'CONFIRMED', note: 'Sem capacete no vídeo.', reviewer: 'op.maria' })
  await page.goto('/#historico')
  await expect(page.getByRole('button', { name: /EPI ausente: capacete/i })).toBeVisible()
})

test('câmeras do setor mostram sinal do Fusion e mudam por WebSocket', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('sem-demo', '1'); localStorage.removeItem('visao-do-porto.demo')
    // WebSocket falso do Fusion: o teste decide quando enviar mudanças
    const Real = window.WebSocket
    class Fake extends EventTarget {
      onopen: ((e: Event) => void) | null = null; onmessage: ((e: MessageEvent) => void) | null = null
      onclose: (() => void) | null = null; onerror: (() => void) | null = null
      constructor(public url: string) {
        super()
        if (!url.includes('/fusion/ws/cameras')) { return new Real(url) as unknown as Fake }
        ;(window as unknown as { __fusion: Fake }).__fusion = this
        setTimeout(() => { this.onopen?.(new Event('open')); this.send_({ type: 'SNAPSHOT', cameras: [{ camera_id: 'CAM-PIER-01', status: 'ONLINE' }] }) }, 50)
      }
      send_(m: unknown) { this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(m) })) }
      close() {}
    }
    ;(window as unknown as { WebSocket: unknown }).WebSocket = Fake
  })
  await page.route('**/api/epi/incident/incidents', r => r.fulfill({ json: [] }))
  await page.route('**/api/epi/tracker/cameras', r => r.fulfill({ json: [
    { camera_id: 'CAM-PIER-01', name: 'Píer 1', sector: 'PIER_BORDO', kind: 'INTERNA', active: true },
    { camera_id: 'CAM-PIER-02', name: 'Píer 2', sector: 'PIER_BORDO', kind: 'ENTRADA', active: true }] }))
  await page.route('**/api/epi/fusion/fusion/cameras/status', r => r.abort())
  await page.goto('/#zonas')
  await page.getByRole('button', { name: /Píer e bordo/i }).click()
  const row = (n: string) => page.locator('.zone-cameras li', { hasText: n })
  await expect(row('Píer 1').getByText('Online')).toBeVisible()
  await expect(row('Píer 2').getByText('Sem dados')).toBeVisible()
  await expect(page.getByText('1/2 câmeras online').first()).toBeVisible()
  await page.evaluate(() => (window as unknown as { __fusion: { send_(m: unknown): void } }).__fusion.send_({ type: 'CAMERA_STATUS_CHANGED', camera_id: 'CAM-PIER-01', status: 'OFFLINE', previous_status: 'ONLINE' }))
  await expect(row('Píer 1').getByText('Sem sinal')).toBeVisible()
})

test('com login exigido: pede usuário e senha, usa o usuário do token e mostra quem revisou', async ({ page }) => {
  await page.addInitScript(() => { sessionStorage.setItem('sem-demo', '1'); localStorage.removeItem('visao-do-porto.demo') })
  let reviewBody: Record<string, unknown> | null = null
  let reviewAuth = ''
  const incident = () => ({ incident_id: 'INC-000001', ppe_type: 'helmet', severity: 'HIGH', status: 'OPEN', reason: 'x', rule_id: 'R', opened_at: '2026-11-23T14:32:00-03:00',
    duration_seconds: 1, source_cameras: ['CAM-PIER-01'], employee_id: 'F1',
    ...(reviewBody ? { review_status: 'CONFIRMED', reviewed_by: 'bruno', review_note: 'ok pelo vídeo', reviewed_at: '2026-11-23T14:40:00-03:00' } : { review_status: 'PENDING' }) })
  await page.route('**/api/epi/incident/incidents', r => r.request().headers()['authorization'] === 'Bearer TOKEN-OK'
    ? r.fulfill({ json: [incident()] }) : r.fulfill({ status: 401, json: { detail: 'Entre com usuário e senha.' } }))
  await page.route('**/api/epi/incident/incidents/INC-000001/review', async r => { reviewBody = r.request().postDataJSON(); reviewAuth = r.request().headers()['authorization']; await r.fulfill({ json: incident() }) })
  await page.route('**/api/epi/tracker/cameras', r => r.fulfill({ json: [] }))
  await page.route('**/api/epi/auth/auth/login', async r => {
    const b = r.request().postDataJSON()
    if (b.password !== 'senha-boa-1') return r.fulfill({ status: 401, json: { detail: 'usuário ou senha inválidos' } })
    await r.fulfill({ json: { access_token: 'TOKEN-OK', token_type: 'bearer', expires_in: 28800, user: { username: 'bruno', name: 'Bruno Alves', role: 'SUPERVISOR', active: true } } })
  })
  await page.goto('/#alertas')
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
  await page.getByLabel('Usuário').fill('bruno'); await page.getByLabel('Senha').fill('errada')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByText('usuário ou senha inválidos')).toBeVisible()
  await page.getByLabel('Senha').fill('senha-boa-1')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('button', { name: /EPI ausente: capacete/i })).toBeVisible()
  await expect(page.getByText('Bruno Alves')).toBeVisible()
  await page.getByRole('button', { name: /EPI ausente: capacete/i }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Revisor:')).toBeVisible()
  await expect(dialog.getByLabel('Revisor')).toHaveCount(0)            // sem campo para digitar nome
  await dialog.getByLabel('Justificativa da revisão').fill('ok pelo vídeo')
  await dialog.getByRole('button', { name: 'Confirmar', exact: true }).click()
  await expect(dialog).toBeHidden()
  expect(reviewAuth).toBe('Bearer TOKEN-OK')
  expect(reviewBody).toEqual({ decision: 'CONFIRMED', note: 'ok pelo vídeo' })   // não envia nome de revisor
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
})

test('evidência: mostra o recorte com caixas por cima (com login), e avisa quando não há imagem ou já foi apagada', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('sem-demo', '1'); localStorage.removeItem('visao-do-porto.demo')
    sessionStorage.setItem('visao-do-porto.session.v1', JSON.stringify({ token: 'TOKEN-OK', username: 'bruno', name: 'Bruno Alves', role: 'OPERADOR' }))
  })
  const inc = (id: string) => ({ incident_id: id, ppe_type: 'helmet', severity: 'HIGH', status: 'OPEN', reason: 'x', rule_id: 'R', opened_at: '2026-11-23T14:32:00-03:00',
    duration_seconds: 1, source_cameras: ['CAM-PIER-01'], employee_id: 'F1', review_status: 'PENDING' })
  await page.route('**/api/epi/incident/incidents', r => r.fulfill({ json: [inc('INC-000001'), inc('INC-000002'), inc('INC-000003')] }))
  await page.route('**/api/epi/tracker/cameras', r => r.fulfill({ json: [] }))
  const auth: string[] = []
  await page.route('**/api/epi/incident/incidents/INC-000001/evidence', r => { auth.push(r.request().headers()['authorization']); return r.fulfill({ json: [
    { evidence_id: 'e1', width: 1, height: 1, detections: [{ label: 'person', bbox: [0.05, 0.05, 0.9, 0.9] }, { label: 'vest', status: 'PRESENT', bbox: [0.2, 0.4, 0.5, 0.3] }], findings: [{ label: 'helmet', status: 'MISSING' }, { label: 'boots', status: 'NOT_VISIBLE' }], purged: false, expires_at: '2026-12-23T00:00:00+00:00' }] }) })
  await page.route('**/api/epi/incident/incidents/INC-000001/evidence/e1/image', r => { auth.push(r.request().headers()['authorization']); return r.fulfill({ body: png, contentType: 'image/png' }) })
  await page.route('**/api/epi/incident/incidents/INC-000002/evidence', r => r.fulfill({ json: [] }))
  await page.route('**/api/epi/incident/incidents/INC-000003/evidence', r => r.fulfill({ json: [{ evidence_id: 'e3', width: 1, height: 1, detections: [], purged: true, expires_at: null }] }))
  await page.goto('/#alertas')
  const open = async (id: string) => { await page.getByRole('button', { name: new RegExp(id) }).first().click() }
  await open('INC-000001')
  const d = page.getByRole('dialog')
  await expect(d.getByAltText('Recorte da pessoa no momento do incidente')).toBeVisible()
  await expect(d.locator('svg rect')).toHaveCount(2)
  await expect(d.getByText('Capacete ausente')).toBeVisible()
  await expect(d.getByText('Botas não visível')).toBeVisible()
  await expect(d.getByText(/Somente o recorte da pessoa/)).toBeVisible()
  expect(auth.length).toBeGreaterThanOrEqual(2)
  expect(new Set(auth)).toEqual(new Set(['Bearer TOKEN-OK']))   // lista e imagem só com o login
  await d.getByRole('button', { name: 'Fechar detalhes' }).click()
  await open('INC-000002')
  await expect(page.getByRole('dialog').getByText(/Nenhuma imagem foi guardada/)).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar detalhes' }).click()
  await open('INC-000003')
  await expect(page.getByRole('dialog').getByText(/apagada pelo prazo de retenção/)).toBeVisible()
})


test('operador acompanha em somente leitura: sem justificativa nem botões de decisão', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('sem-demo', '1'); localStorage.removeItem('visao-do-porto.demo')
    sessionStorage.setItem('visao-do-porto.session.v1', JSON.stringify({ token: 'TOKEN-OP', username: 'bia', name: 'Bia Operadora', role: 'OPERADOR' }))
  })
  await page.route('**/api/epi/incident/incidents', r => r.fulfill({ json: [{ incident_id: 'INC-000001', ppe_type: 'helmet', severity: 'HIGH', status: 'OPEN', reason: 'x', rule_id: 'R',
    opened_at: '2026-11-23T14:32:00-03:00', duration_seconds: 1, source_cameras: ['CAM-PIER-01'], employee_id: 'F1', review_status: 'PENDING' }] }))
  await page.route('**/api/epi/tracker/cameras', r => r.fulfill({ json: [] }))
  await page.route('**/api/epi/incident/incidents/INC-000001/evidence', r => r.fulfill({ json: [] }))
  await page.goto('/#alertas')
  await page.getByRole('button', { name: /EPI ausente: capacete/i }).click()
  const d = page.getByRole('dialog')
  await expect(d.getByTestId('operator-note')).toBeVisible()
  await expect(d.getByLabel('Justificativa da revisão')).toHaveCount(0)
  await expect(d.getByRole('button', { name: 'Confirmar', exact: true })).toHaveCount(0)
  await expect(d.getByRole('button', { name: 'Descartar' })).toHaveCount(0)
})

test('aviso ativo: supervisor vê incidente novo na hora (alerta, contador no título); operador não', async ({ page, browser }) => {
  const inc = (id: string) => ({ incident_id: id, ppe_type: 'helmet', severity: 'HIGH', status: 'OPEN', reason: 'x', rule_id: 'R',
    opened_at: '2026-11-23T14:32:00-03:00', duration_seconds: 1, source_cameras: ['CAM-PIER-01'], employee_id: 'F1', review_status: 'PENDING' })
  const setup = async (p: Page, role: 'SUPERVISOR' | 'OPERADOR', list: () => unknown[]) => {
    await p.addInitScript((r: string) => {
      sessionStorage.setItem('sem-demo', '1'); localStorage.removeItem('visao-do-porto.demo'); localStorage.setItem('visao-do-porto.alert-sound', 'off')
      sessionStorage.setItem('visao-do-porto.session.v1', JSON.stringify({ token: 'T', username: 'u', name: 'Pessoa', role: r }))
    }, role)
    await p.route('**/api/epi/incident/incidents', r => r.fulfill({ json: list() }))
    await p.route('**/api/epi/tracker/cameras', r => r.fulfill({ json: [] }))
    await p.route('**/api/epi/incident/incidents/*/evidence', r => r.fulfill({ json: [] }))
  }
  let items = [inc('INC-000001')]
  await setup(page, 'SUPERVISOR', () => items)
  await page.goto('/#painel')
  await expect(page.getByText('Pendentes de revisão')).toBeVisible()
  await expect(page.getByTestId('notifier').getByText(/Novo incidente/)).toHaveCount(0)        // o que já existia não é "novo"
  items = [inc('INC-000002'), inc('INC-000001')]
  await expect(page.getByTestId('notifier').getByText(/Novo incidente: EPI ausente: capacete/)).toBeVisible({ timeout: 8000 })
  await expect(page.getByTestId('notifier').getByText('Trabalhador: F1')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveTitle(/^\(2\)/)
  await page.getByTestId('notifier').getByRole('button', { name: 'Abrir' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog').getByText('Trabalhador', { exact: true })).toBeVisible()
  const op = await browser.newPage({ baseURL: 'http://127.0.0.1:5173' })
  let items2 = [inc('INC-000001')]
  await setup(op, 'OPERADOR', () => items2)
  await op.goto('/#painel')
  await expect(op.getByText('Pendentes de revisão')).toBeVisible()
  items2 = [inc('INC-000002'), inc('INC-000001')]
  await op.waitForTimeout(4500)
  await expect(op.getByTestId('notifier')).toHaveCount(0)
  await op.close()
})

test('trabalhador: supervisor vê nome, cargo e setor do cadastro; operador só o código; cadastro fora do ar cai para o código', async ({ page, browser }) => {
  const inc = { incident_id: 'INC-000001', ppe_type: 'helmet', severity: 'HIGH', status: 'OPEN', reason: 'x', rule_id: 'R',
    opened_at: '2026-11-23T14:32:00-03:00', duration_seconds: 1, source_cameras: ['CAM-PIER-01'], employee_id: 'FUNC-000001', review_status: 'PENDING' }
  const setup = async (p: Page, role: 'SUPERVISOR' | 'OPERADOR', workers: (url: string) => unknown) => {
    await p.addInitScript((r: string) => {
      sessionStorage.setItem('sem-demo', '1'); localStorage.removeItem('visao-do-porto.demo')
      sessionStorage.setItem('visao-do-porto.session.v1', JSON.stringify({ token: 'TOK-' + r, username: 'u', name: 'Pessoa', role: r }))
    }, role)
    await p.route('**/api/epi/incident/incidents', r => r.fulfill({ json: [inc] }))
    await p.route('**/api/epi/tracker/cameras', r => r.fulfill({ json: [] }))
    await p.route('**/api/epi/incident/incidents/*/evidence', r => r.fulfill({ json: [] }))
    await p.route('**/api/epi/incident/workers/**', r => { workers(r.request().url()); return r.request().headers()['authorization'] === 'Bearer TOK-SUPERVISOR'
      ? r.fulfill({ json: { employee_code: 'FUNC-000001', name: 'Maria Souza', role_title: 'Operadora de guindaste', sector: 'PIER_BORDO', status: 'ACTIVE' } })
      : r.fulfill({ status: 403, json: { detail: 'Somente supervisor.' } }) })
  }
  await setup(page, 'SUPERVISOR', () => undefined)
  await page.goto('/#alertas')
  await page.getByRole('button', { name: /EPI ausente: capacete/i }).click()
  await expect(page.getByRole('dialog').getByText('Maria Souza · Operadora de guindaste · Píer e bordo (FUNC-000001)')).toBeVisible()

  const op = await browser.newPage({ baseURL: 'http://127.0.0.1:5173' })
  const calls: string[] = []
  await setup(op, 'OPERADOR', u => calls.push(u))
  await op.goto('/#alertas')
  await op.getByRole('button', { name: /EPI ausente: capacete/i }).click()
  await expect(op.getByRole('dialog').getByText('FUNC-000001', { exact: true })).toBeVisible()
  await expect(op.getByText('Maria Souza')).toHaveCount(0)
  expect(calls).toEqual([])                                   // operador nem pergunta o nome
  await op.close()

  const down = await browser.newPage({ baseURL: 'http://127.0.0.1:5173' })
  await setup(down, 'SUPERVISOR', () => undefined)
  await down.route('**/api/epi/incident/workers/**', r => r.fulfill({ status: 503, json: { detail: 'Cadastro indisponível.' } }))
  await down.goto('/#alertas')
  await down.getByRole('button', { name: /EPI ausente: capacete/i }).click()
  await expect(down.getByRole('dialog').getByText('FUNC-000001', { exact: true })).toBeVisible()   // cai para o código, sem quebrar
  await down.close()
})
