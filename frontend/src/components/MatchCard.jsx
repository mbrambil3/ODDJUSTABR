import React from "react";
import { Link } from "react-router-dom";
import { getTeamLogo } from "../lib/teamLogos";
import { CaretRight } from "@phosphor-icons/react";

export const MatchCard = ({ match }) => {
  const homeLogo = getTeamLogo(match.home_slug);
  const awayLogo = getTeamLogo(match.away_slug);

  return (
    <Link
      to={`/jogo/${match.match_id}`}
      data-testid={`match-card-${match.match_id}`}
      className="group block bg-[#141414] border border-white/10 hover:border-[#FF5A00]/60 hover:bg-[#1a1a1a] transition-all duration-200 rounded-lg p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <span className="font-mono-num text-[11px] uppercase tracking-[0.25em] text-neutral-500">
          {match.date} {match.time}
        </span>
        <CaretRight size={16} weight="bold" className="text-neutral-600 group-hover:text-[#FF5A00] transition-colors" />
      </div>

      <div className="space-y-3">
        {/* Home */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex-shrink-0 rounded bg-black/40 border border-white/5 flex items-center justify-center">
            {homeLogo ? (
              <img src={homeLogo} alt={match.home} className="w-7 h-7 object-contain" />
            ) : (
              <div className="w-7 h-7 bg-white/10 rounded-sm" />
            )}
          </div>
          <span className="font-heading font-bold text-lg text-white truncate">{match.home}</span>
          <span className="ml-auto text-[10px] uppercase tracking-widest text-neutral-500 font-bold">Casa</span>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 px-1">
          <div className="h-px bg-white/5 flex-1" />
          <span className="font-heading font-black text-xs text-[#FF5A00] tracking-widest">VS</span>
          <div className="h-px bg-white/5 flex-1" />
        </div>

        {/* Away */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex-shrink-0 rounded bg-black/40 border border-white/5 flex items-center justify-center">
            {awayLogo ? (
              <img src={awayLogo} alt={match.away} className="w-7 h-7 object-contain" />
            ) : (
              <div className="w-7 h-7 bg-white/10 rounded-sm" />
            )}
          </div>
          <span className="font-heading font-bold text-lg text-white truncate">{match.away}</span>
          <span className="ml-auto text-[10px] uppercase tracking-widest text-neutral-500 font-bold">Fora</span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Ver análise</span>
        <span className="text-[11px] font-mono-num text-[#CCFF00]/80">odd justa →</span>
      </div>
    </Link>
  );
};
