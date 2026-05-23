import React from "react";

const labels = {
  "1": "Vitória Mandante",
  "X": "Empate",
  "2": "Vitória Visitante",
  "1X": "Mandante ou Empate",
  "2X": "Visitante ou Empate",
  "12": "Mandante ou Visitante",
};

// Classifica o "valor" da aposta com base no edge (%) sobre a odd justa.
const getValueRating = (edgePct) => {
  if (edgePct === null || edgePct === undefined || isNaN(edgePct)) return null;
  if (edgePct >= 10) {
    return {
      label: "Valor Alto",
      symbol: "🔥",
      colorText: "text-[#00E676]",
      colorBg: "bg-[#00E676]/15 border-[#00E676]/45",
      colorBar: "bg-[#00E676]",
      desc: "Odd muito acima do justo — aposta com excelente valor.",
    };
  }
  if (edgePct >= 3) {
    return {
      label: "Com Valor",
      symbol: "✓",
      colorText: "text-[#CCFF00]",
      colorBg: "bg-[#CCFF00]/12 border-[#CCFF00]/40",
      colorBar: "bg-[#CCFF00]",
      desc: "Odd acima do justo — aposta com valor positivo.",
    };
  }
  if (edgePct > -3) {
    return {
      label: "Neutro",
      symbol: "—",
      colorText: "text-neutral-300",
      colorBg: "bg-white/5 border-white/15",
      colorBar: "bg-white/30",
      desc: "Odd próxima do justo — sem vantagem clara.",
    };
  }
  if (edgePct > -10) {
    return {
      label: "Sem Valor",
      symbol: "!",
      colorText: "text-[#FFCC00]",
      colorBg: "bg-[#FFCC00]/10 border-[#FFCC00]/35",
      colorBar: "bg-[#FFCC00]",
      desc: "Odd abaixo do justo — retorno esperado negativo.",
    };
  }
  return {
    label: "Arriscado",
    symbol: "✕",
    colorText: "text-[#FF3B30]",
    colorBg: "bg-[#FF3B30]/15 border-[#FF3B30]/40",
    colorBar: "bg-[#FF3B30]",
    desc: "Odd muito abaixo do justo — evite essa aposta.",
  };
};

export const OddCard = ({ market, odd, percentage, favorable, total, userOdd, onUserOddChange }) => {
  // Likely: lower odd (< 2.0); Unlikely: higher odd (>= 3.5)
  const isLikely = odd !== null && odd !== undefined && odd < 2.0;
  const isUnlikely = odd !== null && odd !== undefined && odd >= 3.5;

  const userOddNum = (() => {
    if (userOdd === null || userOdd === undefined || userOdd === "") return null;
    const n = parseFloat(userOdd);
    return isNaN(n) || n <= 0 ? null : n;
  })();

  let edgePct = null;
  let ev = null;
  let bookieImpliedPct = null;
  if (userOddNum && odd) {
    edgePct = (userOddNum / odd - 1) * 100;
    const p = 1 / odd; // probabilidade implícita pela nossa odd justa
    ev = p * userOddNum - 1; // EV por R$1 apostado
    bookieImpliedPct = (1 / userOddNum) * 100;
  }
  const rating = getValueRating(edgePct);

  const handleChange = (e) => {
    const v = e.target.value;
    if (v === "") {
      onUserOddChange?.(market, null);
      return;
    }
    // Aceita ponto OU vírgula como separador decimal (usuário BR)
    const normalized = v.replace(",", ".");
    // Permite armazenar string parcial enquanto digita (ex: "2.")
    onUserOddChange?.(market, normalized);
  };

  const handleClear = () => onUserOddChange?.(market, null);

  return (
    <div
      data-testid={`odd-card-${market}`}
      className={`relative bg-[#141414] border rounded-lg p-5 transition-all duration-200 ${
        rating ? "border-white/15" : "border-white/10"
      }`}
    >
      {/* Header */}
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

      {/* Fair odd display */}
      <div className="mt-4">
        <div className="text-[9px] uppercase tracking-[0.25em] text-neutral-500 font-bold mb-1">
          Odd justa
        </div>
        <div className="font-mono-num font-black text-5xl text-white leading-none tracking-tighter">
          {odd !== null && odd !== undefined ? odd.toFixed(2) : "—"}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs text-neutral-400 font-medium">
            <span className="font-mono-num text-white font-bold">{favorable}</span>
            <span className="text-neutral-500"> / {total}</span>
            <span className="text-neutral-500 ml-1">favoráveis</span>
          </div>
          <div className="text-xs font-mono-num text-[#CCFF00] font-bold">{percentage}%</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#FF5A00] to-[#CCFF00] rounded-full transition-all duration-500"
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      {/* ===== Bookmaker odd input + value analysis ===== */}
      <div className="mt-5 pt-4 border-t border-white/10">
        <label
          htmlFor={`user-odd-${market}`}
          className="block text-[10px] uppercase tracking-[0.25em] text-neutral-400 font-bold mb-2"
        >
          Odd da casa de aposta
        </label>
        <div className="relative">
          <input
            id={`user-odd-${market}`}
            data-testid={`user-odd-input-${market}`}
            type="text"
            inputMode="decimal"
            placeholder={odd ? `Ex: ${(odd * 1.05).toFixed(2)}` : "—"}
            value={userOdd ?? ""}
            onChange={handleChange}
            disabled={odd === null || odd === undefined}
            className="w-full bg-black/40 border border-white/15 rounded-md px-3 py-2.5 pr-9 font-mono-num text-base text-white placeholder:text-neutral-600 focus:border-[#FF5A00]/60 focus:outline-none focus:ring-1 focus:ring-[#FF5A00]/30 disabled:opacity-40 disabled:cursor-not-allowed transition"
          />
          {userOdd !== null && userOdd !== undefined && userOdd !== "" && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Limpar odd"
              className="absolute right-1 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white text-sm w-7 h-7 inline-flex items-center justify-center rounded hover:bg-white/5 transition"
            >
              ✕
            </button>
          )}
        </div>

        {/* Result block — só aparece quando houver odd válida da casa */}
        {rating && edgePct !== null && (
          <div
            data-testid={`value-result-${market}`}
            className={`mt-3 border ${rating.colorBg} rounded-md p-3 transition-all`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-[10px] font-black uppercase tracking-widest ${rating.colorText}`}>
                <span className="mr-1">{rating.symbol}</span>
                {rating.label}
              </span>
              <span className={`font-mono-num font-black text-lg leading-none ${rating.colorText}`}>
                {edgePct >= 0 ? "+" : ""}
                {edgePct.toFixed(1)}%
              </span>
            </div>
            <p className="text-[11px] text-neutral-300 leading-snug mb-3">{rating.desc}</p>

            {/* Edge gauge */}
            <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden mb-3">
              <div
                className={`absolute top-0 h-full ${rating.colorBar} transition-all duration-500`}
                style={{
                  left: edgePct >= 0 ? "50%" : `${50 + Math.max(edgePct, -50)}%`,
                  width: `${Math.min(Math.abs(edgePct), 50)}%`,
                }}
              />
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20" />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
              <div>
                <div className="text-[9px] uppercase tracking-wider text-neutral-500 font-bold mb-0.5">
                  EV por R$ 1
                </div>
                <div
                  className={`font-mono-num font-bold text-sm ${
                    ev >= 0 ? "text-[#00E676]" : "text-[#FF3B30]"
                  }`}
                >
                  {ev >= 0 ? "+" : ""}R$ {ev.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wider text-neutral-500 font-bold mb-0.5">
                  Prob. da casa
                </div>
                <div className="font-mono-num font-bold text-sm text-neutral-300">
                  {bookieImpliedPct.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
