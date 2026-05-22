"""
Static team and match data for Brasileirão Betano 2026.
Team IDs and match data were collected from flashscore.com.br calendar.
"""

# Teams from Série A 2026 with Flashscore (slug, id)
TEAMS = {
    "athletico-pr": {"name": "Athletico-PR", "id": "UoAxb1Tq", "slug": "athletico-pr"},
    "atletico-mg": {"name": "Atlético-MG", "id": "hGLC5Bah", "slug": "atletico-mg"},
    "bahia": {"name": "Bahia", "id": "UeD7XtzM", "slug": "bahia"},
    "botafogo": {"name": "Botafogo", "id": "jXzWoWa5", "slug": "botafogo"},
    "chapecoense": {"name": "Chapecoense", "id": "jcQV3XP6", "slug": "chapecoense"},
    "corinthians": {"name": "Corinthians", "id": "QBGfQbSe", "slug": "corinthians"},
    "coritiba": {"name": "Coritiba", "id": "KGO4pUqO", "slug": "coritiba"},
    "cruzeiro": {"name": "Cruzeiro", "id": "0SwtclaU", "slug": "cruzeiro"},
    "flamengo": {"name": "Flamengo", "id": "WjxY29qB", "slug": "flamengo"},
    "fluminense": {"name": "Fluminense", "id": "EV9L3kU4", "slug": "fluminense"},
    "gremio": {"name": "Grêmio", "id": "E1EFmhVh", "slug": "gremio"},
    "internacional": {"name": "Internacional", "id": "tSCiHj0I", "slug": "internacional"},
    "mirassol": {"name": "Mirassol", "id": "pQ8ryEe7", "slug": "mirassol"},
    "palmeiras": {"name": "Palmeiras", "id": "hMn9FTbH", "slug": "palmeiras"},
    "red-bull-bragantino": {"name": "Red Bull Bragantino", "id": "jwKvKhGa", "slug": "red-bull-bragantino"},
    "remo": {"name": "Remo", "id": "2i0B6Zul", "slug": "remo"},
    "santos": {"name": "Santos", "id": "n3QdnjFB", "slug": "santos"},
    "sao-paulo": {"name": "São Paulo", "id": "QgP0oAUH", "slug": "sao-paulo"},
    "vasco": {"name": "Vasco", "id": "2RABlYFn", "slug": "vasco"},
    "vitoria": {"name": "Vitória", "id": "8bSbHipn", "slug": "vitoria"},
}

# Lookup by name (normalized)
def get_team_by_name(name: str):
    name_lower = name.lower().strip()
    for key, team in TEAMS.items():
        if team["name"].lower() == name_lower:
            return team
    return None

def get_team_by_slug(slug: str):
    return TEAMS.get(slug)
