from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
from pathlib import Path
from datetime import datetime, timezone, timedelta

from teams_data import TEAMS
from scraper import (
    fetch_rendered_html, parse_calendar, parse_team_results, parse_h2h,
    filter_home_games, filter_away_games, compute_fair_odds, CALENDAR_URL, pw_manager
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Odd Justa - Brasileirão Betano 2026")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 60 * 60 * 2  # 2 hours


# --- Cache helpers ---
async def get_cache(key: str):
    doc = await db.scrape_cache.find_one({"key": key}, {"_id": 0})
    if not doc:
        return None
    ts = doc.get("timestamp")
    try:
        cached_dt = datetime.fromisoformat(ts) if isinstance(ts, str) else ts
        if cached_dt.tzinfo is None:
            cached_dt = cached_dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None
    if datetime.now(timezone.utc) - cached_dt > timedelta(seconds=CACHE_TTL_SECONDS):
        return None
    return doc.get("data")


async def set_cache(key: str, data):
    await db.scrape_cache.update_one(
        {"key": key},
        {"$set": {"key": key, "data": data, "timestamp": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )


async def get_stale_cache(key: str):
    doc = await db.scrape_cache.find_one({"key": key}, {"_id": 0})
    if doc:
        return doc.get("data")
    return None


# --- URL builders ---
def _team_results_url(team_slug: str, team_id: str) -> str:
    return f"https://www.flashscore.com.br/equipe/{team_slug}/{team_id}/resultados/"


def _h2h_url(away_slug: str, away_id: str, home_slug: str, home_id: str, mid: str) -> str:
    return (f"https://www.flashscore.com.br/jogo/futebol/"
            f"{away_slug}-{away_id}/{home_slug}-{home_id}/h2h/?mid={mid}")


async def _get_team_results(team_slug: str, team_id: str, team_name: str, force: bool = False):
    cache_key = f"team_results:{team_slug}:{team_id}"
    if not force:
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached, True
    html = await fetch_rendered_html(_team_results_url(team_slug, team_id), wait_after_idle_ms=2500, click_show_more=3)
    if not html:
        stale = await get_stale_cache(cache_key)
        if stale is not None:
            return stale, True
        return None, False
    results = parse_team_results(html, team_name=team_name, teams_lookup=TEAMS, max_matches=80)
    await set_cache(cache_key, results)
    return results, False


async def _get_h2h(away_slug: str, away_id: str, home_slug: str, home_id: str, mid: str, home_team_name: str, force: bool = False):
    cache_key = f"h2h:{mid}"
    if not force:
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached, True
    html = await fetch_rendered_html(_h2h_url(away_slug, away_id, home_slug, home_id, mid), wait_after_idle_ms=2500)
    if not html:
        stale = await get_stale_cache(cache_key)
        if stale is not None:
            return stale, True
        return None, False
    h2h = parse_h2h(html, current_home_team_name=home_team_name)
    await set_cache(cache_key, h2h)
    return h2h, False


# --- Endpoints ---
@api_router.get("/")
async def root():
    return {"app": "Odd Justa - Brasileirão Betano 2026", "status": "ok"}


@api_router.get("/teams")
async def get_teams():
    return {"teams": list(TEAMS.values())}


@api_router.get("/rounds")
async def get_rounds(force: bool = False):
    cache_key = "calendar:rounds"
    if not force:
        cached = await get_cache(cache_key)
        if cached:
            rounds_all = cached
        else:
            rounds_all = None
    else:
        rounds_all = None

    if rounds_all is None:
        html = await fetch_rendered_html(CALENDAR_URL, wait_after_idle_ms=3000)
        if not html:
            stale = await get_stale_cache(cache_key)
            if stale:
                rounds_all = stale
            else:
                raise HTTPException(status_code=502, detail="Falha ao acessar Flashscore. Tente novamente em instantes.")
        else:
            rounds_all = parse_calendar(html, teams_lookup=TEAMS)
            if not rounds_all:
                raise HTTPException(status_code=502, detail="Não foi possível parsear o calendário.")
            await set_cache(cache_key, rounds_all)

    # Upcoming rounds: take only the first 2 from the calendar (current + next).
    # The first round in the calendar is the closest upcoming = "atual"; the second = "próxima".
    upcoming_rounds = []
    for idx, r in enumerate(rounds_all[:2]):
        flag = "current" if idx == 0 else "next"
        upcoming_rounds.append({**r, "status": flag, "is_analyzable": True})

    upcoming_round_nums = {r["round"] for r in upcoming_rounds}

    # Finalized rounds: built from analysis_snapshots collection (only rounds NOT in upcoming).
    snapshots_cursor = db.analysis_snapshots.find(
        {}, {"_id": 0, "match_id": 1, "match": 1, "scraped_at": 1}
    )
    snapshots = await snapshots_cursor.to_list(length=1000)
    finalized_rounds_dict: dict = {}
    for snap in snapshots:
        m = snap.get("match") or {}
        rn = m.get("round")
        if rn is None or rn in upcoming_round_nums:
            continue
        rd = finalized_rounds_dict.setdefault(rn, {"round": rn, "matches": {}, "status": "finalized", "is_analyzable": True})
        if m.get("match_id") and m["match_id"] not in rd["matches"]:
            rd["matches"][m["match_id"]] = {
                "match_id": m["match_id"],
                "home": m.get("home"),
                "away": m.get("away"),
                "home_slug": m.get("home_slug"),
                "home_id": m.get("home_id"),
                "away_slug": m.get("away_slug"),
                "away_id": m.get("away_id"),
                "date": m.get("date"),
                "time": m.get("time"),
            }
    finalized_rounds = []
    for rn in sorted(finalized_rounds_dict.keys()):
        rd = finalized_rounds_dict[rn]
        finalized_rounds.append({"round": rn, "matches": list(rd["matches"].values()), "status": "finalized", "is_analyzable": True})

    # Combine: finalized (oldest first), then upcoming (current, next)
    combined = finalized_rounds + upcoming_rounds
    return {"rounds": combined, "cached": False}


@api_router.get("/match/{match_id}/analysis")
async def get_match_analysis(match_id: str, force: bool = False):
    rounds_cached = await get_cache("calendar:rounds")
    if not rounds_cached:
        html = await fetch_rendered_html(CALENDAR_URL, wait_after_idle_ms=3000)
        if not html:
            stale = await get_stale_cache("calendar:rounds")
            if stale:
                rounds_cached = stale
            else:
                raise HTTPException(status_code=502, detail="Falha ao acessar Flashscore.")
        else:
            rounds_cached = parse_calendar(html, teams_lookup=TEAMS)
            await set_cache("calendar:rounds", rounds_cached)

    match = None
    round_num = None
    for r in rounds_cached:
        for m in r["matches"]:
            if m["match_id"] == match_id:
                match = m
                round_num = r["round"]
                break
        if match:
            break

    if not match:
        raise HTTPException(status_code=404, detail="Partida não encontrada.")

    home_slug = match["home_slug"]
    home_id = match["home_id"]
    away_slug = match["away_slug"]
    away_id = match["away_id"]
    home_name = match["home"]

    if not home_slug or not away_slug:
        raise HTTPException(status_code=404, detail="Time não mapeado na base de dados.")

    home_task = _get_team_results(home_slug, home_id, home_name, force=force)
    away_task = _get_team_results(away_slug, away_id, match["away"], force=force)
    h2h_task = _get_h2h(away_slug, away_id, home_slug, home_id, match_id, home_name, force=force)
    (home_results, home_cached), (away_results, away_cached), (h2h_results, h2h_cached) = await asyncio.gather(
        home_task, away_task, h2h_task
    )

    if home_results is None or away_results is None:
        raise HTTPException(status_code=502, detail="Falha ao buscar resultados dos times no Flashscore.")
    if h2h_results is None:
        h2h_results = []

    home_home_games = filter_home_games(home_results, n=10)
    away_away_games = filter_away_games(away_results, n=10)
    h2h_last_3 = h2h_results[:3]

    analysis = compute_fair_odds(home_home_games, away_away_games, h2h_last_3)
    analysis["match"] = {**match, "round": round_num}
    analysis["details"] = {
        "home_home_games": home_home_games,
        "away_away_games": away_away_games,
        "h2h": h2h_last_3,
    }
    analysis["cached"] = home_cached and away_cached and h2h_cached
    analysis["scraped_at"] = datetime.now(timezone.utc).isoformat()
    return analysis


@api_router.post("/match/{match_id}/refresh")
async def refresh_match(match_id: str):
    rounds_cached = await get_cache("calendar:rounds") or await get_stale_cache("calendar:rounds")
    if rounds_cached:
        for r in rounds_cached:
            for m in r["matches"]:
                if m["match_id"] == match_id:
                    await db.scrape_cache.delete_many({"key": f"team_results:{m['home_slug']}:{m['home_id']}"})
                    await db.scrape_cache.delete_many({"key": f"team_results:{m['away_slug']}:{m['away_id']}"})
                    await db.scrape_cache.delete_many({"key": f"h2h:{match_id}"})
                    break
    return await get_match_analysis(match_id, force=True)


@api_router.post("/rounds/refresh")
async def refresh_rounds():
    await db.scrape_cache.delete_many({"key": "calendar:rounds"})
    return await get_rounds(force=True)


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
