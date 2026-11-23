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
