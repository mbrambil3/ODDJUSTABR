// Returns a Flashscore static logo URL for a Brasileirão team based on slug.
// Static mapping derived from flashscore.com.br image data.
const TEAM_LOGOS = {
  "athletico-pr": "https://static.flashscore.com/res/image/data/INluPVA6-QaMaOfUh.png",
  "atletico-mg": "https://static.flashscore.com/res/image/data/h8ZzOL5k-UHhQ6Y1N.png",
  "bahia": "https://static.flashscore.com/res/image/data/IL73beA6-dKUmd286.png",
  "botafogo": "https://static.flashscore.com/res/image/data/YyEcuJVH-ldMpXQG1.png",
  "chapecoense": "https://static.flashscore.com/res/image/data/WtA85One-CYex0lQl.png",
  "corinthians": "https://static.flashscore.com/res/image/data/WCPVtuUH-6cpWH3kh.png",
  "coritiba": "https://static.flashscore.com/res/image/data/zZF6CogT-bwYqIWsq.png",
  "cruzeiro": "https://static.flashscore.com/res/image/data/dzBBasiT-SjJmyx86.png",
  "flamengo": "https://static.flashscore.com/res/image/data/8URbBane-2R2JjDQC.png",
  "fluminense": "https://static.flashscore.com/res/image/data/SII56zA6-WUfDDYk1.png",
  "gremio": "https://static.flashscore.com/res/image/data/lnrkBi86-tQsU6dGl.png",
  "internacional": "https://static.flashscore.com/res/image/data/p2TzSgBN-ALgHCh57.png",
  "mirassol": "https://static.flashscore.com/res/image/data/d632vpUH-fVnYQB8j.png",
  "palmeiras": "https://static.flashscore.com/res/image/data/6yCLyXU0-ALgHCh57.png",
  "red-bull-bragantino": "https://static.flashscore.com/res/image/data/fXZwgsRq-UkMF8Udb.png",
  "remo": "https://static.flashscore.com/res/image/data/GEFVWo96-vsDPUWUH.png",
  "santos": "https://static.flashscore.com/res/image/data/hzibzPjC-hv442jSk.png",
  "sao-paulo": "https://static.flashscore.com/res/image/data/jBU0jVPq-AkTesf41.png",
  "vasco": "https://static.flashscore.com/res/image/data/Qw7CsWAN-bam8o1Nj.png",
  "vitoria": "https://static.flashscore.com/res/image/data/dhfeJlkC-QwRlGht5.png",
};

export const getTeamLogo = (slug) => TEAM_LOGOS[slug] || null;
