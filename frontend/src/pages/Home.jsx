import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getRounds, refreshRounds } from "../lib/api";
import { MatchCard } from "../components/MatchCard";
import { ArrowsClockwise, Target, SoccerBall } from "@phosphor-icons/react";

const NEXT_ROUND = 17;

const RoundSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="skeleton h-[210px] rounded-lg border border-white/5" />
    ))}
  </div>
);

export default function Home() {
  const navigate = useNavigate();
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [activeRound, setActiveRound] = useState(NEXT_ROUND);

  const load = async (force = false) => {
    try {
      setError(null);
      if (force) setRefreshing(true);
      else setLoading(true);
      const data = force ? await refreshRounds() : await getRounds();
      setRounds(data.rounds || []);
      if (data.rounds?.length) {
        const next = data.rounds.find((r) => r.round === NEXT_ROUND) || data.rounds[0];
        setActiveRound(next.round);
      }
    } catch (e) {
      setError(e?.response?.data?.detail || "Erro ao carregar rodadas. Tente novamente.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load(false);
  }, []);

  const activeRoundData = useMemo(
    () => rounds.find((r) => r.round === activeRound),
    [rounds, activeRound]
  );

  return (
    <div className="App grain-bg">
      {/* Header */}
      <header className="relative z-10 border-b border-white/10">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-[#FF5A00] flex items-center justify-center">
              <Target size={22} weight="duotone" className="text-black" />
            </div>
            <div>
              <h1 className="font-heading font-black text-2xl md:text-3xl uppercase tracking-tight leading-none text-white">
                Odd Justa
              </h1>
              <p className="text-[10px] md:text-xs uppercase tracking-[0.3em] text-neutral-500 font-bold">
                Brasileirão Betano · 2026
              </p>
            </div>
          </div>

          <button
            data-testid="refresh-rounds-btn"
            onClick={() => load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 bg-transparent border border-white/20 text-white font-bold uppercase tracking-wide text-xs md:text-sm px-3 md:px-5 py-2 md:py-2.5 rounded hover:border-white/40 hover:bg-white/5 transition-all disabled:opacity-50"
          >
            <ArrowsClockwise size={14} weight="bold" className={refreshing ? "animate-spin" : ""} />
            <span className="hidden md:inline">{refreshing ? "Atualizando..." : "Atualizar rodadas"}</span>
            <span className="md:hidden">{refreshing ? "..." : "Atualizar"}</span>
          </button>
        </div>
      </header>

      {/* Hero strip */}
      <section className="relative z-10 border-b border-white/10 bg-[#0A0A0A]">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-8 md:py-12 grid md:grid-cols-2 gap-6 md:gap-12 items-end">
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[#CCFF00] font-bold mb-3">
              <SoccerBall size={14} weight="fill" />
              <span>Análise estatística</span>
            </div>
            <h2 className="font-heading font-black text-4xl sm:text-5xl lg:text-6xl uppercase tracking-tighter leading-[0.9] text-white">
              Encontre o<br />
              <span className="text-[#FF5A00]">valor real</span> da odd.
            </h2>
            <p className="text-sm md:text-base text-neutral-400 mt-4 max-w-xl leading-relaxed">
              Cálculo baseado em <span className="text-white font-bold">últimos 10 jogos do mandante em casa</span>,
              <span className="text-white font-bold"> 10 jogos do visitante fora</span> e
              <span className="text-white font-bold"> últimos 3 confrontos diretos</span> — exclusivamente do Brasileirão Série A.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            <div className="border border-white/10 bg-[#141414] p-4 rounded-lg">
              <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold mb-2">Mercados</div>
              <div className="font-heading font-black text-3xl text-white">6</div>
              <div className="text-[11px] text-neutral-400 mt-1">1, X, 2, 1X, 2X, 12</div>
            </div>
            <div className="border border-white/10 bg-[#141414] p-4 rounded-lg">
              <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold mb-2">Base</div>
              <div className="font-heading font-black text-3xl text-white">23</div>
              <div className="text-[11px] text-neutral-400 mt-1">jogos analisados</div>
            </div>
            <div className="border border-[#FF5A00]/40 bg-[#FF5A00]/5 p-4 rounded-lg">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#FF5A00] font-bold mb-2">Próxima</div>
              <div className="font-heading font-black text-3xl text-white">R{NEXT_ROUND}</div>
              <div className="text-[11px] text-neutral-400 mt-1">rodada principal</div>
            </div>
          </div>
        </div>
      </section>

      {/* Rounds Tabs */}
      <section className="relative z-10 sticky top-0 bg-[#0A0A0A]/95 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8">
          <div className="flex space-x-1 overflow-x-auto no-scrollbar py-2">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skeleton w-20 h-9 rounded flex-shrink-0" />
              ))
            ) : (
              rounds.map((r) => {
                const isActive = r.round === activeRound;
                const isNext = r.round === NEXT_ROUND;
                return (
                  <button
                    key={r.round}
                    data-testid={`round-tab-${r.round}`}
                    onClick={() => setActiveRound(r.round)}
                    className={`flex-shrink-0 px-4 py-2.5 text-xs md:text-sm font-bold uppercase tracking-wide whitespace-nowrap transition-all border-b-2 ${
                      isActive
                        ? "text-[#FF5A00] border-[#FF5A00]"
                        : "text-neutral-400 border-transparent hover:text-white"
                    }`}
                  >
                    Rodada {r.round}
                    {isNext && (
                      <span className="ml-2 inline-block text-[9px] font-black uppercase tracking-widest bg-[#CCFF00] text-black px-1.5 py-0.5 rounded">
                        Próxima
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* Matches Grid */}
      <main className="relative z-10">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-8 md:py-12">
          {error && (
            <div data-testid="error-banner" className="border border-[#FF3B30]/30 bg-[#FF3B30]/5 text-[#FF3B30] rounded-lg p-4 mb-6 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <RoundSkeleton />
          ) : activeRoundData ? (
            <>
              <div className="flex items-end justify-between mb-6">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.3em] text-neutral-500 font-bold mb-1">
                    Confrontos
                  </div>
                  <h3 className="font-heading font-black text-3xl md:text-4xl uppercase tracking-tight leading-none text-white">
                    Rodada {activeRoundData.round}
                  </h3>
                </div>
                <div className="text-right">
                  <div className="font-mono-num font-black text-2xl text-[#FF5A00]">
                    {activeRoundData.matches.length}
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">
                    jogos
                  </div>
                </div>
              </div>
              <div data-testid="matches-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeRoundData.matches.map((m) => (
                  <MatchCard key={m.match_id} match={m} />
                ))}
              </div>
            </>
          ) : (
            <p className="text-neutral-400">Nenhuma rodada encontrada.</p>
          )}
        </div>
      </main>

      <footer className="border-t border-white/10 mt-12">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-6 text-xs text-neutral-500 flex flex-wrap justify-between gap-4">
          <span>Dados: Flashscore.com.br · Cálculo: regra de 3 sobre últimos jogos</span>
          <span className="font-mono-num">v1.0 · Brasileirão Betano 2026</span>
        </div>
      </footer>
    </div>
  );
}
