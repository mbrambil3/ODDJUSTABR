import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getMatchAnalysis, refreshMatch } from "../lib/api";
import { getTeamLogo } from "../lib/teamLogos";
import { OddCard } from "../components/OddCard";
import { ArrowLeft, ArrowsClockwise, Target, ChartBar, Trophy, House, AirplaneTakeoff, Swap, Eraser, Calculator } from "@phosphor-icons/react";

const HERO_BG = "https://images.unsplash.com/photo-1599158150601-1417ebbaafdd?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDJ8MHwxfHNlYXJjaHwxfHxzb2NjZXIlMjBzdGFkaXVtJTIwbmlnaHQlMjBkYXJrfGVufDB8fHx8MTc3OTQ2MjYxMXww&ixlib=rb-4.1.0&q=85";

const Loading = () => (
  <div className="space-y-4">
    <div className="skeleton h-56 rounded-lg" />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skeleton h-44 rounded-lg" />
      ))}
    </div>
  </div>
);

const StatRow = ({ label, value, total }) => (
  <div className="flex justify-between items-center py-1.5 border-b border-white/5 last:border-0">
    <span className="text-xs text-neutral-400">{label}</span>
    <span className="font-mono-num font-bold text-white text-sm">
      {value}<span className="text-neutral-500 font-normal">/{total}</span>
    </span>
  </div>
);

const GameRow = ({ g, perspectiveTeam }) => {
  const isWin = g.result_letter === "V";
  const isLoss = g.result_letter === "D";
  const isDraw = g.result_letter === "E";
  const color = isWin ? "text-[#00E676]" : isLoss ? "text-[#FF3B30]" : "text-[#FFCC00]";
  const bg = isWin ? "bg-[#00E676]/10 border-[#00E676]/20" : isLoss ? "bg-[#FF3B30]/10 border-[#FF3B30]/20" : "bg-[#FFCC00]/10 border-[#FFCC00]/20";

  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <div className="flex-1 min-w-0 text-xs text-neutral-300 truncate">
        <span className={g.home_name === perspectiveTeam ? "text-white font-bold" : ""}>{g.home_name}</span>
        <span className="font-mono-num mx-2 text-white font-bold">{g.home_score} - {g.away_score}</span>
        <span className={g.away_name === perspectiveTeam ? "text-white font-bold" : ""}>{g.away_name}</span>
      </div>
      <span className={`ml-2 inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold border ${bg} ${color}`}>
        {g.result_letter || "?"}
      </span>
    </div>
  );
};

const H2HRow = ({ g, currentHomeName }) => {
  const winnerForCurrentHome = g.current_home_won ? "V" : g.current_home_drew ? "E" : "D";
  const color = winnerForCurrentHome === "V" ? "text-[#00E676]" : winnerForCurrentHome === "D" ? "text-[#FF3B30]" : "text-[#FFCC00]";
  const bg = winnerForCurrentHome === "V" ? "bg-[#00E676]/10 border-[#00E676]/20" : winnerForCurrentHome === "D" ? "bg-[#FF3B30]/10 border-[#FF3B30]/20" : "bg-[#FFCC00]/10 border-[#FFCC00]/20";
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <div className="flex-1 min-w-0 text-xs text-neutral-300">
        <span className="font-mono-num text-neutral-500 mr-2">{g.date}</span>
        <span className={g.home_name === currentHomeName ? "text-white font-bold" : ""}>{g.home_name}</span>
        <span className="font-mono-num mx-2 text-white font-bold">{g.home_score} - {g.away_score}</span>
        <span className={g.away_name === currentHomeName ? "text-white font-bold" : ""}>{g.away_name}</span>
      </div>
      <span className={`ml-2 inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold border ${bg} ${color}`}>
        {winnerForCurrentHome}
      </span>
    </div>
  );
};

export default function MatchAnalysis() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [userOdds, setUserOdds] = useState({});

  const storageKey = matchId ? `oddjusta:user_odds:${matchId}` : null;

  // Load saved user odds for this match (per-match localStorage)
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      setUserOdds(raw ? JSON.parse(raw) : {});
    } catch {
      setUserOdds({});
    }
  }, [storageKey]);

  const handleUserOddChange = (market, value) => {
    setUserOdds((prev) => {
      const next = { ...prev };
      if (value === null || value === undefined || value === "") {
        delete next[market];
      } else {
        next[market] = value;
      }
      try {
        if (storageKey) {
          if (Object.keys(next).length === 0) localStorage.removeItem(storageKey);
          else localStorage.setItem(storageKey, JSON.stringify(next));
        }
      } catch {}
      return next;
    });
  };

  const clearAllUserOdds = () => {
    setUserOdds({});
    try {
      if (storageKey) localStorage.removeItem(storageKey);
    } catch {}
  };

  // Compute summary of value bets across all 6 markets
  const valueSummary = useMemo(() => {
    if (!data?.fair_odds) return { filled: 0, withValue: 0, highValue: 0, best: null };
    const f = data.fair_odds;
    let filled = 0, withValue = 0, highValue = 0;
    let best = null;
    ["1", "X", "2", "1X", "2X", "12"].forEach((m) => {
      const u = parseFloat((userOdds[m] ?? "").toString().replace(",", "."));
      const fair = f[m];
      if (!u || u <= 0 || !fair) return;
      filled++;
      const edge = (u / fair - 1) * 100;
      if (edge >= 3) withValue++;
      if (edge >= 10) highValue++;
      if (!best || edge > best.edge) best = { market: m, edge, userOdd: u, fairOdd: fair };
    });
    return { filled, withValue, highValue, best };
  }, [data, userOdds]);

  const load = async (force = false) => {
    try {
      setError(null);
      if (force) setRefreshing(true);
      else setLoading(true);
      const result = force ? await refreshMatch(matchId) : await getMatchAnalysis(matchId);
      setData(result);
    } catch (e) {
      setError(e?.response?.data?.detail || "Erro ao buscar análise. Tente novamente.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load(false);
    // eslint-disable-next-line
  }, [matchId]);

  if (loading) {
    return (
      <div className="App grain-bg">
        <header className="border-b border-white/10">
          <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-5">
            <Link to="/" className="text-xs uppercase tracking-widest text-neutral-400 hover:text-white font-bold inline-flex items-center gap-2">
              <ArrowLeft size={14} weight="bold" /> Voltar
            </Link>
          </div>
        </header>
        <main className="max-w-[1440px] mx-auto px-4 md:px-8 py-8">
          <div className="text-center text-neutral-400 text-sm mb-6 font-mono-num animate-pulse-soft">
            Buscando dados no Flashscore...
          </div>
          <Loading />
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="App grain-bg">
        <header className="border-b border-white/10">
          <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-5">
            <Link to="/" className="text-xs uppercase tracking-widest text-neutral-400 hover:text-white font-bold inline-flex items-center gap-2">
              <ArrowLeft size={14} weight="bold" /> Voltar
            </Link>
          </div>
        </header>
        <main className="max-w-[1440px] mx-auto px-4 md:px-8 py-12">
          <div data-testid="error-banner" className="border border-[#FF3B30]/30 bg-[#FF3B30]/5 text-[#FF3B30] rounded-lg p-6">
            {error || "Análise indisponível."}
          </div>
          <button
            onClick={() => load(true)}
            className="mt-4 inline-flex items-center gap-2 bg-[#FF5A00] text-white font-bold uppercase tracking-wide text-sm px-5 py-2.5 rounded hover:bg-[#E04F00] transition"
          >
            <ArrowsClockwise size={14} weight="bold" /> Tentar novamente
          </button>
        </main>
      </div>
    );
  }

  const m = data.match;
  const f = data.fair_odds;
  const p = data.percentages;
  const fav = data.favorable;
  const totals = data.totals;
  const homeLogo = getTeamLogo(m.home_slug);
  const awayLogo = getTeamLogo(m.away_slug);

  return (
    <div className="App grain-bg">
      {/* Top nav */}
      <header className="relative z-20 border-b border-white/10 bg-[#0A0A0A]">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-5 flex items-center justify-between">
          <Link to="/" data-testid="back-link" className="text-xs uppercase tracking-widest text-neutral-400 hover:text-white font-bold inline-flex items-center gap-2">
            <ArrowLeft size={14} weight="bold" /> Rodadas
          </Link>
          <button
            data-testid="refresh-analysis-btn"
            onClick={() => load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 bg-transparent border border-white/20 text-white font-bold uppercase tracking-wide text-xs md:text-sm px-3 md:px-5 py-2 md:py-2.5 rounded hover:border-white/40 hover:bg-white/5 transition disabled:opacity-50"
          >
            <ArrowsClockwise size={14} weight="bold" className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Buscando Flashscore..." : "Atualizar análise"}
          </button>
        </div>
      </header>

      {/* Hero */}
      <section
        className="relative overflow-hidden border-b border-white/10"
        style={{ backgroundImage: `url(${HERO_BG})`, backgroundSize: "cover", backgroundPosition: "center" }}
      >
        <div className="absolute inset-0 bg-black/80" />
        <div className="relative z-10 max-w-[1440px] mx-auto px-4 md:px-8 py-12 md:py-16">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#CCFF00] font-bold mb-4">
            Rodada {m.round} · {m.date} {m.time}
          </div>
          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-12">
            <div className="flex flex-col items-center text-center flex-1">
              <div className="w-20 h-20 md:w-28 md:h-28 mb-3 bg-black/40 border border-white/10 rounded-lg flex items-center justify-center">
                {homeLogo ? <img src={homeLogo} alt={m.home} className="w-16 h-16 md:w-20 md:h-20 object-contain" /> : <div className="w-16 h-16 bg-white/10" />}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-[#FF5A00] font-bold mb-1">Mandante</div>
              <h2 className="font-heading font-black text-2xl md:text-4xl uppercase tracking-tight text-white">{m.home}</h2>
            </div>

            <div className="font-heading font-black text-3xl md:text-5xl text-neutral-500 px-4">×</div>

            <div className="flex flex-col items-center text-center flex-1">
              <div className="w-20 h-20 md:w-28 md:h-28 mb-3 bg-black/40 border border-white/10 rounded-lg flex items-center justify-center">
                {awayLogo ? <img src={awayLogo} alt={m.away} className="w-16 h-16 md:w-20 md:h-20 object-contain" /> : <div className="w-16 h-16 bg-white/10" />}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold mb-1">Visitante</div>
              <h2 className="font-heading font-black text-2xl md:text-4xl uppercase tracking-tight text-white">{m.away}</h2>
            </div>
          </div>
        </div>
      </section>

      <main className="relative z-10 max-w-[1440px] mx-auto px-4 md:px-8 py-8 md:py-12 space-y-12">
        {/* Value Bet helper banner */}
        <section
          data-testid="value-bet-banner"
          className="border border-white/10 bg-gradient-to-br from-[#141414] to-[#0F0F0F] rounded-lg p-5 md:p-6"
        >
          <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
            <div className="flex items-start gap-3 flex-1">
              <div className="w-10 h-10 rounded-md bg-[#CCFF00]/10 border border-[#CCFF00]/30 flex items-center justify-center flex-shrink-0">
                <Calculator size={20} weight="duotone" className="text-[#CCFF00]" />
              </div>
              <div>
                <h4 className="font-heading font-black text-lg md:text-xl uppercase tracking-tight text-white leading-tight">
                  Compare com a casa de aposta
                </h4>
                <p className="text-xs md:text-sm text-neutral-400 mt-1 leading-relaxed">
                  Cole a odd que a casa está oferecendo em cada mercado abaixo. Calculamos o
                  <span className="text-white font-bold"> edge (% de valor)</span> e o
                  <span className="text-white font-bold"> EV</span> para te dizer se vale a aposta.
                </p>
              </div>
            </div>

            {/* Summary chips */}
            <div className="flex items-center gap-2 md:gap-3 flex-wrap">
              <div className="border border-white/10 bg-black/30 rounded-md px-3 py-2 text-center min-w-[70px]">
                <div className="font-mono-num font-black text-xl text-white leading-none">
                  {valueSummary.filled}
                  <span className="text-neutral-500 text-sm font-normal">/6</span>
                </div>
                <div className="text-[9px] uppercase tracking-widest text-neutral-500 font-bold mt-1">
                  Preenchidas
                </div>
              </div>
              <div
                className={`border rounded-md px-3 py-2 text-center min-w-[70px] ${
                  valueSummary.withValue > 0
                    ? "border-[#CCFF00]/40 bg-[#CCFF00]/5"
                    : "border-white/10 bg-black/30"
                }`}
              >
                <div
                  className={`font-mono-num font-black text-xl leading-none ${
                    valueSummary.withValue > 0 ? "text-[#CCFF00]" : "text-neutral-500"
                  }`}
                >
                  {valueSummary.withValue}
                </div>
                <div className="text-[9px] uppercase tracking-widest text-neutral-500 font-bold mt-1">
                  Com valor
                </div>
              </div>
              <div
                className={`border rounded-md px-3 py-2 text-center min-w-[70px] ${
                  valueSummary.highValue > 0
                    ? "border-[#00E676]/40 bg-[#00E676]/5"
                    : "border-white/10 bg-black/30"
                }`}
              >
                <div
                  className={`font-mono-num font-black text-xl leading-none ${
                    valueSummary.highValue > 0 ? "text-[#00E676]" : "text-neutral-500"
                  }`}
                >
                  {valueSummary.highValue}
                </div>
                <div className="text-[9px] uppercase tracking-widest text-neutral-500 font-bold mt-1">
                  Valor alto
                </div>
              </div>

              {valueSummary.filled > 0 && (
                <button
                  data-testid="clear-user-odds-btn"
                  onClick={clearAllUserOdds}
                  className="ml-1 inline-flex items-center gap-1.5 border border-white/15 hover:border-white/30 hover:bg-white/5 text-neutral-300 text-[11px] font-bold uppercase tracking-wider px-3 py-2 rounded transition"
                >
                  <Eraser size={14} weight="bold" /> Limpar
                </button>
              )}
            </div>
          </div>

          {/* Best opportunity highlight */}
          {valueSummary.best && valueSummary.best.edge >= 3 && (
            <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center gap-3">
              <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold">
                Melhor oportunidade →
              </span>
              <span className="font-heading font-black text-base text-white uppercase">
                Mercado {valueSummary.best.market}
              </span>
              <span className="font-mono-num text-sm text-neutral-400">
                casa <span className="text-white font-bold">{valueSummary.best.userOdd.toFixed(2)}</span>
                <span className="mx-1.5">·</span>
                justa <span className="text-white font-bold">{valueSummary.best.fairOdd.toFixed(2)}</span>
              </span>
              <span
                className={`font-mono-num font-black text-base ${
                  valueSummary.best.edge >= 10 ? "text-[#00E676]" : "text-[#CCFF00]"
                }`}
              >
                +{valueSummary.best.edge.toFixed(1)}%
              </span>
            </div>
          )}
        </section>

        {/* Resultado (1, X, 2) */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <Target size={20} weight="duotone" className="text-[#FF5A00]" />
            <h3 className="font-heading font-black text-2xl md:text-3xl uppercase tracking-tight text-white">
              Resultado da Partida
            </h3>
            <div className="ml-auto text-[10px] uppercase tracking-widest text-neutral-500 font-bold">
              Mercado 1X2
            </div>
          </div>
          <div data-testid="market-1x2" className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <OddCard market="1" odd={f["1"]} percentage={p["1"]} favorable={fav["1"]} total={totals.total_analyzed} userOdd={userOdds["1"]} onUserOddChange={handleUserOddChange} />
            <OddCard market="X" odd={f["X"]} percentage={p["X"]} favorable={fav["X"]} total={totals.total_analyzed} userOdd={userOdds["X"]} onUserOddChange={handleUserOddChange} />
            <OddCard market="2" odd={f["2"]} percentage={p["2"]} favorable={fav["2"]} total={totals.total_analyzed} userOdd={userOdds["2"]} onUserOddChange={handleUserOddChange} />
          </div>
        </section>

        {/* Dupla Chance */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <Swap size={20} weight="duotone" className="text-[#CCFF00]" />
            <h3 className="font-heading font-black text-2xl md:text-3xl uppercase tracking-tight text-white">
              Dupla Chance
            </h3>
            <div className="ml-auto text-[10px] uppercase tracking-widest text-neutral-500 font-bold">
              Mercado DC
            </div>
          </div>
          <div data-testid="market-dc" className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <OddCard market="1X" odd={f["1X"]} percentage={p["1X"]} favorable={fav["1X"]} total={totals.total_analyzed} userOdd={userOdds["1X"]} onUserOddChange={handleUserOddChange} />
            <OddCard market="2X" odd={f["2X"]} percentage={p["2X"]} favorable={fav["2X"]} total={totals.total_analyzed} userOdd={userOdds["2X"]} onUserOddChange={handleUserOddChange} />
            <OddCard market="12" odd={f["12"]} percentage={p["12"]} favorable={fav["12"]} total={totals.total_analyzed} userOdd={userOdds["12"]} onUserOddChange={handleUserOddChange} />
          </div>
        </section>

        {/* Statistical breakdown */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <ChartBar size={20} weight="duotone" className="text-white" />
            <h3 className="font-heading font-black text-2xl md:text-3xl uppercase tracking-tight text-white">
              Base estatística
            </h3>
            <div className="ml-auto text-[10px] uppercase tracking-widest text-neutral-500 font-bold">
              {totals.total_analyzed} jogos · só Brasileirão
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Home at home */}
            <div data-testid="stat-home-home" className="bg-[#141414] border border-white/10 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <House size={16} weight="bold" className="text-[#FF5A00]" />
                <h4 className="font-heading font-bold text-sm uppercase tracking-wider text-white">
                  {m.home} em casa
                </h4>
              </div>
              <StatRow label="Vitórias" value={data.home_stats.wins} total={totals.home_games_count} />
              <StatRow label="Empates" value={data.home_stats.draws} total={totals.home_games_count} />
              <StatRow label="Derrotas" value={data.home_stats.losses} total={totals.home_games_count} />
              <div className="mt-3 pt-3 border-t border-white/5">
                <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold mb-2">
                  Últimos {totals.home_games_count} jogos em casa
                </div>
                <div className="max-h-56 overflow-y-auto pr-1">
                  {data.details.home_home_games.map((g) => (
                    <GameRow key={g.match_id} g={g} perspectiveTeam={m.home} />
                  ))}
                </div>
              </div>
            </div>

            {/* Away away */}
            <div data-testid="stat-away-away" className="bg-[#141414] border border-white/10 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <AirplaneTakeoff size={16} weight="bold" className="text-[#CCFF00]" />
                <h4 className="font-heading font-bold text-sm uppercase tracking-wider text-white">
                  {m.away} fora
                </h4>
              </div>
              <StatRow label="Vitórias" value={data.away_stats.wins} total={totals.away_games_count} />
              <StatRow label="Empates" value={data.away_stats.draws} total={totals.away_games_count} />
              <StatRow label="Derrotas" value={data.away_stats.losses} total={totals.away_games_count} />
              <div className="mt-3 pt-3 border-t border-white/5">
                <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold mb-2">
                  Últimos {totals.away_games_count} jogos fora
                </div>
                <div className="max-h-56 overflow-y-auto pr-1">
                  {data.details.away_away_games.map((g) => (
                    <GameRow key={g.match_id} g={g} perspectiveTeam={m.away} />
                  ))}
                </div>
              </div>
            </div>

            {/* H2H */}
            <div data-testid="stat-h2h" className="bg-[#141414] border border-white/10 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <Trophy size={16} weight="bold" className="text-[#FF5A00]" />
                <h4 className="font-heading font-bold text-sm uppercase tracking-wider text-white">
                  Confronto direto
                </h4>
              </div>
              <StatRow label={`Vitórias ${m.home}`} value={data.h2h_stats.home_wins} total={totals.h2h_count} />
              <StatRow label="Empates" value={data.h2h_stats.draws} total={totals.h2h_count} />
              <StatRow label={`Vitórias ${m.away}`} value={data.h2h_stats.home_losses} total={totals.h2h_count} />
              <div className="mt-3 pt-3 border-t border-white/5">
                <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold mb-2">
                  Últimos {totals.h2h_count} confrontos · só SRA
                </div>
                <div className="max-h-56 overflow-y-auto pr-1">
                  {data.details.h2h.map((g, i) => (
                    <H2HRow key={i} g={g} currentHomeName={m.home} />
                  ))}
                  {data.details.h2h.length === 0 && (
                    <div className="text-xs text-neutral-500 italic py-2">Nenhum confronto direto encontrado no Brasileirão.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Methodology */}
        <section className="border border-white/10 bg-[#141414] rounded-lg p-6">
          <h4 className="font-heading font-bold text-sm uppercase tracking-widest text-neutral-400 mb-3">
            Como calculamos
          </h4>
          <p className="text-sm text-neutral-300 leading-relaxed">
            Para cada mercado, somamos os eventos favoráveis nos {totals.total_analyzed} jogos analisados
            ({totals.home_games_count} do mandante em casa + {totals.away_games_count} do visitante fora + {totals.h2h_count} H2H).
            Calculamos a porcentagem (favoráveis ÷ total × 100) e a <span className="text-white font-bold">odd justa = 100 ÷ porcentagem</span>.
            Quanto mais baixa a odd justa, mais provável o evento.
          </p>
          {data.scraped_at && (
            <div className="mt-3 text-[11px] font-mono-num text-neutral-500">
              Última atualização: {new Date(data.scraped_at).toLocaleString("pt-BR")} {data.cached ? "(cache)" : ""}
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-white/10 mt-12">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-6 text-xs text-neutral-500 flex flex-wrap justify-between gap-4">
          <span>Dados: Flashscore.com.br · Filtro: Brasileirão Série A</span>
          <span className="font-mono-num">Odd Justa v1.0</span>
        </div>
      </footer>
    </div>
  );
}
