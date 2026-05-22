import React from "react";

const labels = {
  "1": "Vitória Mandante",
  "X": "Empate",
  "2": "Vitória Visitante",
  "1X": "Mandante ou Empate",
  "2X": "Visitante ou Empate",
  "12": "Mandante ou Visitante",
};

export const OddCard = ({ market, odd, percentage, favorable, total, highlight = false }) => {
  // Likely: lower odd (< 2.0); Unlikely: higher odd (>= 3.5)
  const isLikely = odd !== null && odd < 2.0;
  const isUnlikely = odd !== null && odd >= 3.5;

  return (
    <div
      data-testid={`odd-card-${market}`}
      className={`relative bg-[#141414] border ${highlight ? "border-[#FF5A00]/40" : "border-white/10"} rounded-lg p-5 hover:border-white/20 transition-all duration-200`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-heading font-black text-3xl tracking-tighter text-white">{market}</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold mt-0.5">
            {labels[market]}
          </div>
        </div>
        {isLikely && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#00E676] bg-[#00E676]/10 border border-[#00E676]/20 px-2 py-0.5 rounded">
            Provável
          </span>
        )}
        {isUnlikely && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#FF3B30] bg-[#FF3B30]/10 border border-[#FF3B30]/20 px-2 py-0.5 rounded">
            Improvável
          </span>
        )}
      </div>

      <div className="mt-4">
        <div className="font-mono-num font-black text-5xl text-white leading-none tracking-tighter">
          {odd !== null && odd !== undefined ? odd.toFixed(2) : "—"}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs text-neutral-400 font-medium">
            <span className="font-mono-num text-white font-bold">{favorable}</span>
            <span className="text-neutral-500"> / {total}</span>
            <span className="text-neutral-500 ml-1">favoráveis</span>
          </div>
          <div className="text-xs font-mono-num text-[#CCFF00] font-bold">
            {percentage}%
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#FF5A00] to-[#CCFF00] rounded-full transition-all duration-500"
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
};
