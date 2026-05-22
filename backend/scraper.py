"""
Flashscore.com.br scraper for Brasileirão Betano 2026 using Playwright.
"""
import re
import os
import asyncio
import logging
from typing import List, Dict, Optional, Tuple
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright

# Use system-installed Playwright browsers (set before launch)
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/pw-browsers")

logger = logging.getLogger(__name__)

CALENDAR_URL = "https://www.flashscore.com.br/futebol/brasil/brasileirao-betano/calendario/"
BRASILEIRAO_LABEL = "Brasileirão Betano"
USER_AGENT = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36")

MATCH_HREF_RE = re.compile(r"/jogo/futebol/([^/]+)/([^/]+)/\?mid=([A-Za-z0-9]+)")


# --- Single shared browser context (lazy) ---
class _PWManager:
    def __init__(self):
        self._pw = None
        self._browser = None
        self._lock = asyncio.Lock()

    async def get_browser(self):
        async with self._lock:
            if self._browser is None or not self._browser.is_connected():
                if self._pw is None:
                    self._pw = await async_playwright().start()
                self._browser = await self._pw.chromium.launch(
                    headless=True,
                    args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
                )
            return self._browser

    async def close(self):
        if self._browser:
            try:
                await self._browser.close()
            except Exception:
                pass
        if self._pw:
            try:
                await self._pw.stop()
            except Exception:
                pass


pw_manager = _PWManager()


async def fetch_rendered_html(url: str, wait_after_idle_ms: int = 2500, click_show_more: int = 0) -> Optional[str]:
    """Fetch a page using Playwright, returning the rendered HTML."""
    try:
        browser = await pw_manager.get_browser()
        ctx = await browser.new_context(user_agent=USER_AGENT, viewport={"width": 1280, "height": 800})
        page = await ctx.new_page()
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=35000)
            try:
                await page.wait_for_selector(".event__match", timeout=15000)
            except Exception:
                pass
            await page.wait_for_timeout(wait_after_idle_ms)

            # Click "Mostrar mais jogos" if asked
            for _ in range(click_show_more):
                try:
                    btn = page.locator('a:has-text("Mostrar mais jogos")').first
                    await btn.scroll_into_view_if_needed(timeout=2000)
                    await btn.click(timeout=2000)
                    await page.wait_for_timeout(1200)
                except Exception:
                    break

            html = await page.content()
            return html
        finally:
            await page.close()
            await ctx.close()
    except Exception as e:
        logger.exception(f"fetch_rendered_html error for {url}: {e}")
        return None


# --- Parsers ---
def _slug_id(s: str) -> Tuple[str, str]:
    if "-" in s:
        parts = s.rsplit("-", 1)
        return parts[0], parts[1]
    return s, ""


def parse_calendar(html: str, teams_lookup: Optional[Dict[str, Dict]] = None) -> List[Dict]:
    """Parse rendered calendar HTML.
    teams_lookup: optional dict mapping normalized team name -> {slug,id,name} for authoritative lookup.
    """
    soup = BeautifulSoup(html, "lxml")
    rounds: Dict[int, Dict] = {}
    current_round = None

    def lookup(name: str) -> Tuple[str, str]:
        if not teams_lookup:
            return "", ""
        n = (name or "").strip().lower()
        for t in teams_lookup.values():
            if t["name"].lower() == n:
                return t["slug"], t["id"]
        return "", ""

    for el in soup.descendants:
        name = getattr(el, "name", None)
        if name is None:
            continue
        classes = el.get("class") or []
        cls_str = " ".join(classes)
        if "event__round" in cls_str:
            txt = el.get_text(strip=True)
            m = re.search(r"Rodada\s+(\d+)", txt)
            if m:
                current_round = int(m.group(1))
            continue
        if "event__match" in cls_str and current_round is not None:
            mid_el = el.get("id") or ""
            mid_m = re.match(r"g_1_([A-Za-z0-9]+)", mid_el)
            if not mid_m:
                continue
            mid = mid_m.group(1)
            r = rounds.setdefault(current_round, {"round": current_round, "matches": {}})
            if mid in r["matches"]:
                continue
            time_el = el.select_one(".event__time")
            time_txt = time_el.get_text(" ", strip=True) if time_el else ""
            date_str, time_str = "", ""
            dt = re.search(r"(\d{2}\.\d{2}\.)\s*(\d{2}:\d{2})?", time_txt)
            if dt:
                date_str = dt.group(1)
                time_str = dt.group(2) or ""
            home_el = el.select_one(".event__homeParticipant img")
            away_el = el.select_one(".event__awayParticipant img")
            if home_el is None or away_el is None:
                continue
            home_name = home_el.get("alt") or ""
            away_name = away_el.get("alt") or ""

            home_slug, home_id = lookup(home_name)
            away_slug, away_id = lookup(away_name)

            link = el.select_one("a.eventRowLink")
            url_match = link.get("href") if link else ""

            r["matches"][mid] = {
                "match_id": mid,
                "home": home_name,
                "away": away_name,
                "home_slug": home_slug,
                "home_id": home_id,
                "away_slug": away_slug,
                "away_id": away_id,
                "date": date_str,
                "time": time_str,
                "url": url_match,
            }

    out = []
    for rn in sorted(rounds.keys()):
        out.append({"round": rn, "matches": list(rounds[rn]["matches"].values())})
    return out


def parse_team_results(html: str, team_name: str, teams_lookup: Optional[Dict[str, Dict]] = None, max_matches: int = 80) -> List[Dict]:
    """Parse team /resultados page filtered by Brasileirão Betano.
    team_name: the canonical name of the team whose results page we're parsing.
    Returns list of {match_id, home_name, away_name, home_id, away_id, home_score, away_score, result_letter, team_was_home}
    """
    soup = BeautifulSoup(html, "lxml")
    current_comp = None

    def lookup(name: str) -> Tuple[str, str]:
        if not teams_lookup:
            return "", ""
        n = (name or "").strip().lower()
        for t in teams_lookup.values():
            if t["name"].lower() == n:
                return t["slug"], t["id"]
        return "", ""

    team_name_lower = (team_name or "").strip().lower()

    results = []
    for el in soup.descendants:
        name = getattr(el, "name", None)
        if name is None:
            continue
        classes = el.get("class") or []
        cls_str = " ".join(classes)
        if "headerLeague__title-text" in cls_str or "headerLeague__title" in cls_str:
            current_comp = el.get_text(" ", strip=True)
            continue
        if "event__match" not in cls_str:
            continue
        if current_comp != BRASILEIRAO_LABEL:
            continue
        mid_el = el.get("id") or ""
        mid_m = re.match(r"g_1_([A-Za-z0-9]+)", mid_el)
        if not mid_m:
            continue
        mid = mid_m.group(1)
        home_el = el.select_one(".event__homeParticipant img")
        away_el = el.select_one(".event__awayParticipant img")
        if home_el is None or away_el is None:
            continue
        home_name = home_el.get("alt") or ""
        away_name = away_el.get("alt") or ""
        score_h = el.select_one(".event__score--home")
        score_a = el.select_one(".event__score--away")
        if score_h is None or score_a is None:
            continue
        try:
            home_score = int(score_h.get_text(strip=True))
            away_score = int(score_a.get_text(strip=True))
        except ValueError:
            continue
        letter = None
        if el.select_one('[data-testid="wcl-badgeForm-win"]'):
            letter = "V"
        elif el.select_one('[data-testid="wcl-badgeForm-lose"]'):
            letter = "D"
        elif el.select_one('[data-testid="wcl-badgeForm-draw"]'):
            letter = "E"

        team_was_home = None
        hn = home_name.lower().strip()
        an = away_name.lower().strip()
        if hn == team_name_lower:
            team_was_home = True
        elif an == team_name_lower:
            team_was_home = False

        h_slug, h_id = lookup(home_name)
        a_slug, a_id = lookup(away_name)

        results.append({
            "match_id": mid,
            "home_name": home_name,
            "away_name": away_name,
            "home_id": h_id,
            "away_id": a_id,
            "home_score": home_score,
            "away_score": away_score,
            "result_letter": letter,
            "team_was_home": team_was_home,
        })
        if len(results) >= max_matches:
            break
    return results


def parse_h2h(html: str, current_home_team_name: str) -> List[Dict]:
    """Parse H2H page. Filter only Brasileirão matches in 'Confrontos diretos'.
    current_home_team_name = name of HOME team for current/upcoming match.
    Returns list ordered newest first.
    """
    soup = BeautifulSoup(html, "lxml")
    results = []
    home_team_lower = (current_home_team_name or "").strip().lower()

    # H2H section headers
    sections = soup.select(".h2h__section")
    direct_section = None
    for sec in sections:
        header = sec.select_one(".section__title, .h2h__title, .wcl-h2hSubsectionHeader_OZmJg, .wcl-h2hSubsectionHeader, .wcl-headerSection_5507Y")
        header_txt = (header.get_text(" ", strip=True) if header else "").lower()
        # also check entire section's first heading text
        if not header_txt:
            first_h = sec.find(re.compile(r"^h[1-6]$"))
            if first_h:
                header_txt = first_h.get_text(" ", strip=True).lower()
        if "confronto" in header_txt:
            direct_section = sec
            break
    if direct_section is None and sections:
        direct_section = sections[-1]

    rows = direct_section.select(".h2h__row") if direct_section else soup.select(".h2h__row")

    for row in rows:
        # Competition filter: check for Brasileirão tag (text 'SRA' is the short tag)
        full_text = row.get_text(" ", strip=True)
        comp_event = row.select_one(".h2h__event")
        comp_short = (comp_event.get_text(" ", strip=True) if comp_event else "").strip()
        is_brasileirao = (
            comp_short == "SRA" or "SRA" in full_text.split()
            or "Brasileirão" in full_text or "Série A" in full_text
        )
        if not is_brasileirao:
            continue

        date_m = re.search(r"(\d{2}\.\d{2}\.\d{2,4})", full_text)
        date_str = date_m.group(1) if date_m else ""

        home_el = row.select_one(".h2h__participant--home, .h2h__homeParticipant")
        away_el = row.select_one(".h2h__participant--away, .h2h__awayParticipant")
        if not home_el or not away_el:
            parts = row.select(".h2h__participant")
            if len(parts) >= 2:
                home_el = home_el or parts[0]
                away_el = away_el or parts[1]
        home_name = home_el.get_text(" ", strip=True) if home_el else ""
        away_name = away_el.get_text(" ", strip=True) if away_el else ""

        # Scores: try several selectors
        home_score = away_score = None
        result_el = row.select_one(".h2h__result")
        if result_el:
            spans = result_el.find_all(["span", "div"])
            nums = []
            for s in spans:
                t = s.get_text(strip=True)
                if t.isdigit():
                    nums.append(int(t))
            if len(nums) >= 2:
                home_score, away_score = nums[0], nums[1]
        if home_score is None:
            digits = re.findall(r"\b(\d{1,2})\b", full_text)
            # Filter out year digits if present
            if date_str:
                # remove year/day/month numbers
                date_parts = re.findall(r"\d+", date_str)
                for dp in date_parts:
                    try:
                        digits.remove(dp)
                    except ValueError:
                        pass
            if len(digits) >= 2:
                try:
                    home_score = int(digits[-2])
                    away_score = int(digits[-1])
                except Exception:
                    continue
            else:
                continue

        # Determine if current home team won (regardless of who was home in this H2H match)
        hn = home_name.lower().strip()
        an = away_name.lower().strip()
        if hn == home_team_lower:
            cur_home_won = home_score > away_score
            cur_home_drew = home_score == away_score
        elif an == home_team_lower:
            cur_home_won = away_score > home_score
            cur_home_drew = home_score == away_score
        else:
            continue

        results.append({
            "date": date_str,
            "home_name": home_name,
            "away_name": away_name,
            "home_score": home_score,
            "away_score": away_score,
            "current_home_won": cur_home_won,
            "current_home_drew": cur_home_drew,
        })
    return results


def filter_home_games(results: List[Dict], n: int = 10) -> List[Dict]:
    return [r for r in results if r.get("team_was_home")][:n]


def filter_away_games(results: List[Dict], n: int = 10) -> List[Dict]:
    return [r for r in results if r.get("team_was_home") is False][:n]


def compute_fair_odds(home_results: List[Dict], away_results: List[Dict], h2h: List[Dict]) -> Dict:
    home_games = home_results[:10]
    away_games = away_results[:10]
    h2h_games = h2h[:3]

    # Home team playing AT HOME stats
    home_wins_home = sum(1 for g in home_games if g["home_score"] > g["away_score"])
    home_draws_home = sum(1 for g in home_games if g["home_score"] == g["away_score"])
    home_losses_home = sum(1 for g in home_games if g["home_score"] < g["away_score"])

    # Away team playing AWAY (team_was_home=False) stats (from the away team's perspective)
    # home_score corresponds to other team (the home of those matches), away_score corresponds to the team itself
    away_losses_away = sum(1 for g in away_games if g["home_score"] > g["away_score"])
    away_draws_away = sum(1 for g in away_games if g["home_score"] == g["away_score"])
    away_wins_away = sum(1 for g in away_games if g["home_score"] < g["away_score"])

    h2h_total = len(h2h_games)
    h2h_home_wins = sum(1 for g in h2h_games if g.get("current_home_won"))
    h2h_draws = sum(1 for g in h2h_games if g.get("current_home_drew"))
    h2h_home_losses = h2h_total - h2h_home_wins - h2h_draws

    total_games = len(home_games) + len(away_games) + h2h_total

    def fair_odd(favorable: int, total: int):
        if total == 0 or favorable == 0:
            return None
        pct = (favorable / total) * 100.0
        return round(100.0 / pct, 2)

    fav_1 = home_wins_home + away_losses_away + h2h_home_wins
    fav_X = home_draws_home + away_draws_away + h2h_draws
    fav_2 = home_losses_home + away_wins_away + h2h_home_losses
    fav_1X = fav_1 + fav_X
    fav_2X = fav_2 + fav_X
    fav_12 = fav_1 + fav_2

    return {
        "totals": {
            "home_games_count": len(home_games),
            "away_games_count": len(away_games),
            "h2h_count": h2h_total,
            "total_analyzed": total_games,
        },
        "home_stats": {"wins": home_wins_home, "draws": home_draws_home, "losses": home_losses_home},
        "away_stats": {"wins": away_wins_away, "draws": away_draws_away, "losses": away_losses_away},
        "h2h_stats": {"home_wins": h2h_home_wins, "draws": h2h_draws, "home_losses": h2h_home_losses},
        "favorable": {"1": fav_1, "X": fav_X, "2": fav_2, "1X": fav_1X, "2X": fav_2X, "12": fav_12},
        "fair_odds": {
            "1": fair_odd(fav_1, total_games), "X": fair_odd(fav_X, total_games), "2": fair_odd(fav_2, total_games),
            "1X": fair_odd(fav_1X, total_games), "2X": fair_odd(fav_2X, total_games), "12": fair_odd(fav_12, total_games),
        },
        "percentages": {
            "1": round((fav_1/total_games)*100,1) if total_games else 0,
            "X": round((fav_X/total_games)*100,1) if total_games else 0,
            "2": round((fav_2/total_games)*100,1) if total_games else 0,
            "1X": round((fav_1X/total_games)*100,1) if total_games else 0,
            "2X": round((fav_2X/total_games)*100,1) if total_games else 0,
            "12": round((fav_12/total_games)*100,1) if total_games else 0,
        }
    }
