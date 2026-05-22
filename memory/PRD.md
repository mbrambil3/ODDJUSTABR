# PRD — Odd Justa (Brasileirão Betano 2026)

## Problema original
Site que calcula a "Odd Justa" para cada confronto do Brasileirão Betano 2026. Dados scraped do Flashscore.com.br. Para cada partida: Resultado (1, X, 2) + Dupla Chance (1X, 2X, 12). Cálculo: últimos 10 jogos do mandante em casa + 10 do visitante fora + 3 H2H — só Brasileirão Série A. Fair odd = 100 / ((favoráveis / total) * 100). Rodada 17 = próxima.

## Arquitetura
- **Backend**: FastAPI + Playwright (Chromium headless) + BeautifulSoup. Cache MongoDB 2h.
- **Frontend**: React + Tailwind + shadcn + @phosphor-icons/react. Tema escuro "Performance Pro" (Barlow Condensed + DM Sans).
- **Scraping**: Flashscore.com.br via Playwright (PLAYWRIGHT_BROWSERS_PATH=/pw-browsers).

## User Persona
Apostador esportivo / analista que quer comparar a odd justa estatística com a odd da casa Betano para encontrar valor.

## Core Requirements (estáticos)
- Listar todas as rodadas do Brasileirão 2026, com R17 destacada como "Próxima"
- 10 jogos por rodada
- Análise detalhada por confronto com 6 odds justas
- Refresh manual (calendário + análise)
- Filtragem rigorosa: apenas partidas do Brasileirão Série A

## Implementado (22.05.2026)
- [x] Mapping estático de 20 times Série A (slug + Flashscore ID)
- [x] Scraping rodadas/calendário via Playwright
- [x] Scraping resultados de cada time (filtrado por "Brasileirão Betano")
- [x] Scraping H2H (filtrado por SRA)
- [x] Cálculo de 6 fair odds + percentuais + breakdown estatístico
- [x] Cache MongoDB com fallback stale
- [x] Frontend: Home com tabs de rodadas + match cards
- [x] Frontend: Página de análise com hero, 6 odds cards, 3 stats panels, refresh button
- [x] Loading skeletons + tratamento de erro
- [x] Testes backend (8/8 pass) + frontend (100% pass)

## Backlog (P1/P2)
- P1: Comparação manual de odd justa vs odd da casa Betano (input de odd + cálculo de EV)
- P1: Filtro de competição na análise (incluir Copa do Brasil, etc.)
- P2: Histórico de palpites (logged-in users) + tracking de acertos
- P2: Notificações push de odds favoráveis
- P2: Compartilhar análise em rede social

## Endpoints
- `GET /api/rounds[?force=true]` — calendário (cache 2h)
- `GET /api/match/{mid}/analysis[?force=true]` — análise + 6 odds
- `POST /api/match/{mid}/refresh` — limpa cache e re-scrape
- `POST /api/rounds/refresh` — refresh calendário
- `GET /api/teams` — lista de times Série A

## Next Action Items
1. (Opcional) Adicionar comparação com odd da casa Betano (EV calculator)
2. Monitorar estabilidade do scraper conforme Flashscore atualizar CSS classes
3. Considerar fila/job assíncrono para pré-aquecer cache da rodada principal
