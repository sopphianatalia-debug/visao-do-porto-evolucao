# Evolução (cópia da Sophia) — registro de mudanças

Base: https://github.com/diegovitor90/visao-do-porto @ 65c5f23 (17/11/2026). O original não é alterado.

## 1. Spring — trabalhadores (23/11/2026)
- Novos campos opcionais `setor` (um dos 6 códigos do EPI Vision) e `cargo`.
- A API deixa de devolver a entidade JPA: usa `TrabalhadorResponse`.
- `PUT /api/trabalhadores/{id}` edita nome, empresa, setor e cargo (matrícula não muda).
- `PATCH /api/trabalhadores/{id}/ativo` com `{"ativo": false|true}` desativa/reativa. Inativo continua sem receber capacitação (409).
- `POST` continua aceitando o corpo antigo (só nome, matrícula, empresa). Setor inválido → 400.
- Testes novos em `TrabalhadorServiceTest`.
- **Não validado por build:** a sandbox não alcança o Maven Central. Rodar `./mvnw test` em `backend/backend-springboot`.
- Continua pendente: autenticação/perfis e persistência (H2 em memória).

## 2. FastAPI — porta 8100 (23/11/2026)
- A FastAPI de visão passa de `8000` para `8100` (README, `frontend/README.md`, `.env.example`, `vite.config.ts`), para não colidir com o `epi_ppe` do EPI Vision. Quem já define `VISION_API_TARGET` não é afetado.

## 3. Front — ligado aos serviços EPI Vision (23/11/2026)
- Nova camada de dados (`features/operations/live.ts` + `DataContext.tsx`): consulta a cada 3 s o **Incident (:8004)** e o **Tracker (:8010)** pelo proxy do Vite (`/api/epi/incident`, `/api/epi/tracker`; alvos configuráveis por `EPI_INCIDENT_TARGET` e `EPI_TRACKER_TARGET`).
- **Ao vivo:** incidentes abertos viram a fila de alertas ("EPI ausente: capacete"), o setor vem do cadastro de câmeras do Tracker, e a página Zonas mostra os 6 setores do porto com estado por pendência. Incidente de câmera sem setor cai em "Sem setor".
- **Sem serviços:** as telas mostram "Serviços indisponíveis" e tentam de novo a cada 3 s. Os dados de exemplo só aparecem se pedidos de propósito (`localStorage['visao-do-porto.demo']='1'`, usado pelos testes antigos).
- Limites conhecidos: a revisão ainda é salva no navegador (o Incident não tem estados de revisão); a evidência em imagem não existe nos serviços; só incidentes `OPEN` são listados, então uma revisão some do histórico quando o incidente é resolvido. Os três pontos entram nas fases de persistência/revisão.
- Teste novo (Playwright, com respostas simuladas dos serviços). 10 testes passam.
- Para ver ao vivo: subir `epi_incident` e `epi_tracker` do repositório `epi-vision-porto-itaqui` e rodar `npm run dev` em `frontend/`.

- Atualização: a reserva automática com dados simulados foi removida; 11 testes passam (inclui o caso "serviços indisponíveis").

## 4. Nosso lado (repositório epi-vision-porto-itaqui) — 23/11/2026
- **Incident — revisão humana:** `POST /incidents/{id}/review` (`CONFIRMED`/`DISMISSED`/`INSUFFICIENT_EVIDENCE`), com justificativa e revisor obrigatórios e trilha `review_history`. Não altera `OPEN/RESOLVED`.
- **Incident — persistência:** `INC_DB_PATH` liga SQLite; incidentes, revisões e idempotência sobrevivem a reinício.
- **Incident — WebSocket:** `/api/v1/ws/incidents` (snapshot + eventos). 63 testes passam; verificado com servidor real.
- **Front:** passa a escutar o WebSocket e relê na hora; a consulta de 3 s continua como reserva.
- Pendente: a revisão do front ainda grava no navegador (próximo passo: enviar para `/review`); login (o revisor hoje é texto); evidência em imagem; WebSocket de saúde das câmeras; latitude/longitude nas câmeras; vídeo.

## 5. Revisão gravada no serviço (23/11/2026)
- Ao vivo, "Confirmar/Descartar/Evidência insuficiente" envia o parecer ao `POST /incidents/{id}/review` (decisão, justificativa e **revisor**, campo novo, obrigatório). O histórico e a fila passam a vir do serviço: a decisão aparece em qualquer computador.
- A fila mostra os incidentes abertos; o histórico mostra os já revisados, mesmo que depois resolvidos.
- Se o serviço recusar ou estiver fora, a janela mostra o motivo e nada é gravado no navegador. Em modo de exemplo (demo) a revisão continua local.
- O nome do revisor é lembrado só no navegador (conveniência). Sem login, ele ainda é texto informado.

## 6. Lat/long nas câmeras e saúde das câmeras por WebSocket (23/11/2026)
- **Tracker:** câmeras aceitam `latitude`/`longitude` opcionais (juntas, dentro dos limites); campos novos na tela *Gerenciar câmeras* do Tracker. Câmeras antigas continuam carregando. 75 testes.
- **Fusion:** `GET /fusion/cameras/status` e `ws://.../fusion/ws/cameras` (`ONLINE`/`OFFLINE` por câmera, snapshot + mudanças; padrão: sem observação há 30 s = sem sinal). 69 testes.
- **Front (Zonas):** cada setor mostra "N/M câmeras online"; o detalhe lista as câmeras do setor com **Online / Sem sinal / Sem dados / Desconhecido**. Atualiza por WebSocket; só consulta por REST quando o WebSocket está fechado. "Sem sinal" não indica violação.
- Verificado ponta a ponta com Incident, Tracker e Fusion reais e o proxy do Vite (online → sem sinal após silêncio → online de novo).
- Proxy novo: `/api/epi/fusion` → `:8002` (`EPI_FUSION_TARGET`).

## 7. Login no front (24/11/2026)
- Tela "Entrar" (usuário e senha) quando o Incident está em `INC_AUTH_MODE=required`; o token (JWT do `epi_auth`) fica só no `sessionStorage` e vai no cabeçalho `Authorization` e no WebSocket (`?token=`). Se o login não for exigido, a tela abre direto, como antes.
- Revisão: o revisor passa a ser o usuário logado (campo de nome some; o serviço ignora qualquer nome enviado). Barra lateral mostra nome, perfil e **Sair**. Sessão expirada (401) volta para o login.
- Proxy novo: `/api/epi/auth` → `:8006` (`EPI_AUTH_TARGET`). 14 testes do front passam (inclui login com senha errada/certa, revisão com token e sair).
- Ainda não há tela para o supervisor gerenciar usuários (a API existe; criar o primeiro pelo CLI do `epi_auth`).
- Verificado ponta a ponta com `epi_auth`, Incident (`required`) e Tracker reais: senha errada recusada, operador entra e revisa, o serviço guarda `operador / OPERADOR / verificado`, e o supervisor sobrescreve.
