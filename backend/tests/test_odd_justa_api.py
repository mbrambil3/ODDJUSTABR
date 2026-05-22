"""Tests for Odd Justa API (rounds + match analysis)."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://odd-justa-br.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# Matches mentioned in the request
SP_BOTAFOGO_MID = "G44gJJzh"
GREMIO_SANTOS_MID = "prHje7l2"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- Health ---
def test_root(session):
    r = session.get(f"{API}/", timeout=30)
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


def test_teams(session):
    r = session.get(f"{API}/teams", timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert "teams" in data
    assert len(data["teams"]) == 20
    names = [t["name"] for t in data["teams"]]
    assert "São Paulo" in names
    assert "Botafogo" in names


# --- Rounds ---
def test_rounds_returns_structure(session):
    r = session.get(f"{API}/rounds", timeout=120)
    assert r.status_code == 200, f"got {r.status_code}: {r.text[:300]}"
    data = r.json()
    assert "rounds" in data
    rounds = data["rounds"]
    assert isinstance(rounds, list)
    assert len(rounds) >= 12, f"Expected 12+ rounds, got {len(rounds)}"

    # Verify match structure on at least one match
    sample_round = next((r for r in rounds if r["matches"]), None)
    assert sample_round is not None
    sample = sample_round["matches"][0]
    for key in ["home", "away", "home_slug", "home_id", "away_slug", "away_id", "match_id", "date", "time"]:
        assert key in sample, f"missing {key} in {sample}"


def test_round_17_exists(session):
    r = session.get(f"{API}/rounds", timeout=120)
    rounds = r.json()["rounds"]
    r17 = next((rr for rr in rounds if rr["round"] == 17), None)
    assert r17 is not None, "Rodada 17 not found"
    assert len(r17["matches"]) >= 5, f"R17 should have ~10 matches, got {len(r17['matches'])}"


def test_gremio_santos_mapping(session):
    r = session.get(f"{API}/rounds", timeout=120)
    rounds = r.json()["rounds"]
    found = None
    for rr in rounds:
        for m in rr["matches"]:
            if m["match_id"] == GREMIO_SANTOS_MID:
                found = m
                break
        if found:
            break
    if not found:
        pytest.skip(f"match {GREMIO_SANTOS_MID} not in calendar")
    assert found["home_slug"] == "gremio", f"home_slug expected gremio, got {found['home_slug']}"
    assert found["away_slug"] == "santos"


# --- Match analysis ---
def test_match_invalid_returns_404(session):
    r = session.get(f"{API}/match/INVALID/analysis", timeout=120)
    assert r.status_code == 404
    detail = r.json().get("detail", "")
    assert "não encontrada" in detail.lower()


def test_match_sp_botafogo_analysis(session):
    r = session.get(f"{API}/match/{SP_BOTAFOGO_MID}/analysis", timeout=180)
    assert r.status_code == 200, f"got {r.status_code}: {r.text[:500]}"
    data = r.json()

    # match metadata
    m = data["match"]
    assert m["home"] == "São Paulo", f"home={m['home']}"
    assert m["away"] == "Botafogo", f"away={m['away']}"

    # fair_odds
    fo = data["fair_odds"]
    for k in ["1", "X", "2", "1X", "2X", "12"]:
        assert k in fo

    # totals
    totals = data["totals"]
    for k in ["home_games_count", "away_games_count", "h2h_count", "total_analyzed"]:
        assert k in totals
    assert totals["home_games_count"] <= 10
    assert totals["away_games_count"] <= 10
    assert totals["h2h_count"] <= 3

    # favorable, percentages
    for k in ["1", "X", "2", "1X", "2X", "12"]:
        assert k in data["favorable"]
        assert k in data["percentages"]

    # stats
    assert "wins" in data["home_stats"]
    assert "wins" in data["away_stats"]
    assert "home_wins" in data["h2h_stats"]

    # details
    det = data["details"]
    assert "home_home_games" in det
    assert "away_away_games" in det
    assert "h2h" in det
    # H2H must only contain Brasileirão matches; we don't get a comp field, but capped at 3
    assert len(det["h2h"]) <= 3

    # Verify all home_home_games are team_was_home=true AND involve São Paulo
    for g in det["home_home_games"]:
        assert g["team_was_home"] is True, f"non-home game in home_home_games: {g}"
        assert g["home_name"] == "São Paulo" or g["away_name"] == "São Paulo", f"SP not in {g}"

    for g in det["away_away_games"]:
        assert g["team_was_home"] is False, f"non-away game in away_away_games: {g}"
        assert g["home_name"] == "Botafogo" or g["away_name"] == "Botafogo", f"Botafogo not in {g}"

    # scraped_at
    assert "scraped_at" in data


def test_match_sp_botafogo_fair_odds_reasonable(session):
    """Sanity check: 1 should be < 2 typically and odds should be reasonable."""
    r = session.get(f"{API}/match/{SP_BOTAFOGO_MID}/analysis", timeout=180)
    data = r.json()
    fo = data["fair_odds"]
    # All fair odds present should be > 1
    for k, v in fo.items():
        if v is not None:
            assert v > 1.0, f"odd {k}={v} should be > 1"
            assert v < 50, f"odd {k}={v} unreasonably high"
