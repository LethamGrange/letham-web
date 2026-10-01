
 ⛅️ wrangler 4.124.0 (update available 4.145.0)
───────────────────────────────────────────────
Resource location: local 

Use --remote if you want to access the remote instance.

🌀 Executing on local database curling_league (30784ec7-c658-420e-a390-c6a11ce24ba9) from .wrangler/state/v3/d1:
🌀 To execute on your remote database, add a --remote flag to your wrangler command.
🚣 1 command executed successfully.
[
  {
    "results": [
      {
        "sql": "CREATE TABLE teams (\n    id INTEGER PRIMARY KEY AUTOINCREMENT,\n    team_name TEXT UNIQUE NOT NULL\n)"
      },
      {
        "sql": "CREATE TABLE clubs_or_rinks (\n    id INTEGER PRIMARY KEY AUTOINCREMENT,\n    name TEXT UNIQUE NOT NULL, \n    type TEXT CHECK(type IN ('internal', 'external')) NOT NULL\n)"
      },
      {
        "sql": "CREATE TABLE _cf_METADATA (\n        key INTEGER PRIMARY KEY,\n        value BLOB\n      )"
      },
      {
        "sql": "CREATE TABLE users (\n    id INTEGER PRIMARY KEY AUTOINCREMENT,\n    username TEXT UNIQUE NOT NULL,\n    password_hash TEXT NOT NULL,\n    role TEXT NOT NULL DEFAULT 'user'\n)"
      },
      {
        "sql": "CREATE TABLE sessions (\n    token TEXT PRIMARY KEY,\n    user_id INTEGER NOT NULL,\n    expires_at INTEGER NOT NULL,\n    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE\n)"
      },
      {
        "sql": "CREATE TABLE \"competition_reserves\" (\n    id INTEGER PRIMARY KEY AUTOINCREMENT,\n    competition_id INTEGER REFERENCES \"competitions\"(id) ON DELETE CASCADE,\n    player_name TEXT NOT NULL\n)"
      },
      {
        "sql": "CREATE TABLE \"d1_migrations\"(\n\t\tid         INTEGER PRIMARY KEY AUTOINCREMENT,\n\t\tname       TEXT UNIQUE,\n\t\tapplied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL\n)"
      },
      {
        "sql": "CREATE TABLE \"competitions\" (\n    id TEXT PRIMARY KEY,               \n    season_year TEXT NOT NULL,\n    name TEXT UNIQUE NOT NULL,\n    kind TEXT NOT NULL,\n    sub_kind TEXT DEFAULT 'full'\n, reserves TEXT)"
      },
      {
        "sql": "CREATE TABLE \"competition_teams\" (\n    id TEXT PRIMARY KEY,               \n    competition_id TEXT,               \n    team_index INTEGER NOT NULL,\n    team_name TEXT NOT NULL,\n    FOREIGN KEY(competition_id) REFERENCES \"competitions\"(id) ON DELETE CASCADE\n)"
      },
      {
        "sql": "CREATE TABLE \"fixtures\" (\n    id TEXT PRIMARY KEY,\n    competition_id TEXT NOT NULL,\n    fixture_date TEXT,                 \n    fixture_time TEXT,                 \n    FOREIGN KEY(competition_id) REFERENCES \"competitions\"(id) ON DELETE CASCADE\n)"
      },
      {
        "sql": "CREATE TABLE \"games\" (\n    id TEXT PRIMARY KEY,\n    fixture_id TEXT NOT NULL,          \n    team_a TEXT,                    \n    team_b TEXT, sequence INTEGER DEFAULT 0,                    \n    FOREIGN KEY(fixture_id) REFERENCES \"fixtures\"(id) ON DELETE CASCADE,\n    FOREIGN KEY(team_a) REFERENCES \"competition_teams\"(id) ON DELETE SET NULL,\n    FOREIGN KEY(team_b) REFERENCES \"competition_teams\"(id) ON DELETE SET NULL\n)"
      },
      {
        "sql": "CREATE TABLE \"team_players\" (\n    id TEXT PRIMARY KEY,\n    team_id TEXT,\n    name TEXT NOT NULL,\n    role TEXT CHECK(role IN ('skip', 'third', 'second', 'lead', 'regular')) DEFAULT 'regular',\n    FOREIGN KEY(team_id) REFERENCES \"competition_teams\"(id) ON DELETE CASCADE\n)"
      },
      {
        "sql": "CREATE TABLE \"pool_players\" (\n    id TEXT PRIMARY KEY,\n    team_id TEXT,\n    name TEXT NOT NULL,\n    FOREIGN KEY(team_id) REFERENCES \"competition_teams\"(id) ON DELETE CASCADE\n)"
      },
      {
        "sql": "CREATE TABLE \"matches\" (\n    id INTEGER PRIMARY KEY AUTOINCREMENT,\n    match_date TEXT NOT NULL,\n    match_time TEXT NOT NULL,\n    sheet TEXT CHECK(sheet IN ('A', 'B', 'C', 'D', 'E', 'F')) NOT NULL,\n    competition_name TEXT NOT NULL,\n    team_a_id INTEGER,\n    team_b_id INTEGER,\n    team_a_skip TEXT,\n    team_a_third TEXT,\n    team_a_second TEXT,\n    team_a_lead TEXT,\n    team_b_skip TEXT,\n    team_b_third TEXT,\n    team_b_second TEXT,\n    team_b_lead TEXT,\n    final_score_a INTEGER DEFAULT 0,\n    final_score_b INTEGER DEFAULT 0,\n    team_a_ends TEXT,\n    team_b_ends TEXT,\n\n    \n    FOREIGN KEY(team_a_id) REFERENCES clubs_or_rinks(id) ON DELETE SET NULL,\n    FOREIGN KEY(team_b_id) REFERENCES clubs_or_rinks(id) ON DELETE SET NULL\n)"
      }
    ],
    "success": true,
    "meta": {
      "duration": 1
    }
  }
]
