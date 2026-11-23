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
