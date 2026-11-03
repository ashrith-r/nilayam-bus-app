from __future__ import annotations

import csv
import hashlib
import hmac
import io
import json
import os
import secrets
import sqlite3
import sys
import threading
import time
import webbrowser
import zipfile
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


PRODUCT = "NILAYA"
DEMO_PASSWORD = "NilayaDemo!2026"
MAX_IMPORT_BYTES = 100 * 1024 * 1024
LOCAL_BOX = (17.85, 18.12, 79.35, 79.78)  # south, north, west, east; Warangal tri-city
ROLES = {"passenger", "operator", "admin", "display", "demo"}
SESSION_LOCK = threading.Lock()
SESSIONS: dict[str, tuple[str, float]] = {}


def resource_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(getattr(sys, "_MEIPASS"))
    return Path(__file__).resolve().parent.parent


ROOT = resource_root()
WEB_ROOT = ROOT / "web"


def data_directory() -> Path:
    explicit = os.environ.get("NILAYA_DATA_DIR")
    if explicit:
        path = Path(explicit).expanduser()
    else:
        base = os.environ.get("LOCALAPPDATA")
        if base:
            path = Path(base) / "NILAYA"
        else:
            path = Path.home() / "AppData" / "Local" / "NILAYA"
    path.mkdir(parents=True, exist_ok=True)
    return path


DB_PATH = data_directory() / "demo.sqlite3"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def local_now() -> datetime:
    # India Standard Time has no daylight-saving transition; using a fixed offset
    # keeps schedule rendering reliable in packaged Windows builds without tzdata.
    return datetime.now(timezone(timedelta(hours=5, minutes=30)))


def connect() -> sqlite3.Connection:
    db = sqlite3.connect(DB_PATH, timeout=20)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    db.execute("PRAGMA busy_timeout=20000")
    return db


@contextmanager
def db_session():
    db = connect()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def password_record(password: str, salt: bytes | None = None) -> tuple[str, str]:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 310_000)
    return salt.hex(), digest.hex()


def verify_password(password: str, salt_hex: str, digest_hex: str) -> bool:
    salt = bytes.fromhex(salt_hex)
    proposed = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 310_000).hex()
    return hmac.compare_digest(proposed, digest_hex)


def audit(db: sqlite3.Connection, actor: str, role: str, action: str, detail: str, source: str = "") -> None:
    db.execute(
        "INSERT INTO activity(created_at, actor, role, action, detail, source) VALUES(?,?,?,?,?,?)",
        (utc_now(), actor, role, action, detail, source),
    )


def seed_location(db: sqlite3.Connection, row: tuple[str, str, float, float, str, str, str]) -> None:
    name, category, lat, lon, area, aliases, url = row
    db.execute(
        """INSERT OR IGNORE INTO locations(name,category,lat,lon,area,aliases,source_url,source,updated_at)
           VALUES(?,?,?,?,?,?,?,?,?)""",
        (name, category, lat, lon, area, aliases, url, "OpenStreetMap / public place references; map marker for orientation", utc_now()),
    )


def initialize_database() -> None:
    with db_session() as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS users(
              id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL,
              role TEXT NOT NULL, salt TEXT NOT NULL, password_hash TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1
            );
            CREATE TABLE IF NOT EXISTS locations(
              id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL, category TEXT NOT NULL,
              lat REAL NOT NULL, lon REAL NOT NULL, area TEXT NOT NULL DEFAULT '', aliases TEXT NOT NULL DEFAULT '',
              source_url TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS activity(
              id INTEGER PRIMARY KEY, created_at TEXT NOT NULL, actor TEXT NOT NULL, role TEXT NOT NULL,
              action TEXT NOT NULL, detail TEXT NOT NULL, source TEXT NOT NULL DEFAULT ''
            );
            CREATE INDEX IF NOT EXISTS activity_created_idx ON activity(created_at DESC);
            CREATE TABLE IF NOT EXISTS announcements(
              id INTEGER PRIMARY KEY, title TEXT NOT NULL, message TEXT NOT NULL, severity TEXT NOT NULL,
              location_id INTEGER REFERENCES locations(id), starts_at TEXT NOT NULL, ends_at TEXT,
              status TEXT NOT NULL DEFAULT 'active', created_by TEXT NOT NULL, created_at TEXT NOT NULL, source TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS observations(
              id INTEGER PRIMARY KEY, location_id INTEGER NOT NULL REFERENCES locations(id), route_label TEXT NOT NULL,
              destination TEXT NOT NULL, departure_at TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
              entered_by TEXT NOT NULL, entered_at TEXT NOT NULL, source TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS queue_tokens(
              id INTEGER PRIMARY KEY, token TEXT UNIQUE NOT NULL, passenger_label TEXT NOT NULL,
              location_id INTEGER NOT NULL REFERENCES locations(id), sequence_no INTEGER NOT NULL,
              status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
              hold_expires_at TEXT, called_at TEXT
            );
            CREATE TABLE IF NOT EXISTS gtfs_routes(
              route_id TEXT PRIMARY KEY, agency_id TEXT, short_name TEXT, long_name TEXT, route_type TEXT
            );
            CREATE TABLE IF NOT EXISTS gtfs_stops(
              stop_id TEXT PRIMARY KEY, stop_name TEXT NOT NULL, lat REAL NOT NULL, lon REAL NOT NULL,
              location_id INTEGER REFERENCES locations(id)
            );
            CREATE INDEX IF NOT EXISTS gtfs_stops_coords_idx ON gtfs_stops(lat,lon);
            CREATE TABLE IF NOT EXISTS gtfs_trips(
              trip_id TEXT PRIMARY KEY, route_id TEXT NOT NULL, service_id TEXT NOT NULL,
              headsign TEXT NOT NULL DEFAULT '', direction_id TEXT NOT NULL DEFAULT ''
            );
            CREATE TABLE IF NOT EXISTS gtfs_stop_times(
              trip_id TEXT NOT NULL, stop_id TEXT NOT NULL, arrival_time TEXT NOT NULL,
              departure_time TEXT NOT NULL, stop_sequence INTEGER NOT NULL,
              PRIMARY KEY(trip_id,stop_sequence)
            );
            CREATE INDEX IF NOT EXISTS gtfs_stop_times_stop_idx ON gtfs_stop_times(stop_id,departure_time);
            CREATE TABLE IF NOT EXISTS gtfs_calendar(
              service_id TEXT PRIMARY KEY, monday INTEGER, tuesday INTEGER, wednesday INTEGER,
              thursday INTEGER, friday INTEGER, saturday INTEGER, sunday INTEGER,
              start_date TEXT NOT NULL, end_date TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS gtfs_calendar_dates(
              service_id TEXT NOT NULL, service_date TEXT NOT NULL, exception_type INTEGER NOT NULL,
              PRIMARY KEY(service_id,service_date)
            );
            CREATE TABLE IF NOT EXISTS gtfs_imports(
              id INTEGER PRIMARY KEY, imported_at TEXT NOT NULL, filename TEXT NOT NULL,
              local_stops INTEGER NOT NULL, local_trips INTEGER NOT NULL, source TEXT NOT NULL
            );
            """
        )
        if not db.execute("SELECT 1 FROM users WHERE username='admin'").fetchone():
            for username, display, role in (("admin", "Demo administrator", "admin"), ("operator", "Demo operator", "operator")):
                salt, hashed = password_record(DEMO_PASSWORD)
                db.execute(
                    "INSERT INTO users(username,display_name,role,salt,password_hash) VALUES(?,?,?,?,?)",
                    (username, display, role, salt, hashed),
                )
        locations = [
            ("Warangal City Bus Station", "Bus station", 17.97455, 79.60535, "Warangal", "Warangal Bus Stand; Warangal bus station; RTC bus stand", "https://www.tgsrtc.telangana.gov.in/open-data"),
            ("Hanamkonda City Bus Station", "Bus station", 18.00299, 79.56681, "Hanamkonda", "Hanamkonda Bus Stand; Hanmakonda; Hanamkonda bus station", "https://www.tgsrtc.telangana.gov.in/open-data"),
            ("Kazipet Bus Stop", "Bus stop", 17.97715, 79.51078, "Kazipet", "Kazipet bus stop; Khazipet", "https://www.openstreetmap.org/search?query=Kazipet%20Bus%20stop%2C%20Warangal"),
            ("Warangal Railway Station", "Railway station", 17.97320, 79.60740, "Warangal", "Warangal station; WGL railway station", "https://www.openstreetmap.org/search?query=Warangal%20Railway%20Station"),
            ("Thousand Pillar Temple", "Landmark", 18.00380, 79.57470, "Hanamkonda", "Thousand Pillars Temple; Rudreswara Swamy Temple", "https://tourism.telangana.gov.in/attractions/thousand-pillars-temple"),
            ("Bhadrakali Temple", "Landmark", 17.99490, 79.58310, "Warangal–Hanamkonda", "Bhadrakali Temple Warangal", "https://www.tourism.telangana.gov.in/page/warangal"),
            ("Warangal Fort", "Landmark", 17.95720, 79.61440, "Warangal", "Orugallu Fort; Kakatiya Fort", "https://warangal.telangana.gov.in/tourist-place/warangal-fort/"),
            ("MGM Government Hospital", "Hospital", 17.98990, 79.59319, "Warangal", "MGM Hospital; Mahatma Gandhi Memorial Government Hospital", "https://www.mgmwarangal.com/contact.html"),
        ]
        for item in locations:
            seed_location(db, item)
        seed_simulation(db)
        if not db.execute("SELECT 1 FROM meta WHERE key='seeded' ").fetchone():
            db.execute("INSERT OR REPLACE INTO meta(key,value) VALUES('seeded','1')")
            audit(db, "NILAYA demo", "system", "demo.ready", "Local demo initialized with Warangal tri-city places. No real passenger records or bus departures were fabricated.", "Demo seed")
            audit(db, "Example journey", "passenger", "passenger.search", "Example only: Warangal City Bus Station → Thousand Pillar Temple", "Demo seed")
            audit(db, "Demo operator", "operator", "operator.login", "Example operator activity for the local walkthrough", "Demo seed")


def seed_simulation(db: sqlite3.Connection) -> None:
    db.execute("""CREATE TABLE IF NOT EXISTS simulation_services(
        id INTEGER PRIMARY KEY, from_id INTEGER NOT NULL REFERENCES locations(id),
        to_id INTEGER NOT NULL REFERENCES locations(id), route TEXT NOT NULL,
        headway INTEGER NOT NULL, duration INTEGER NOT NULL, UNIQUE(from_id,to_id))""")
    places = db.execute("SELECT id,lat,lon FROM locations ORDER BY id").fetchall()
    for start in places:
        for end in places:
            if start["id"] == end["id"]:
                continue
            distance = ((start["lat"]-end["lat"])**2 + (start["lon"]-end["lon"])**2)**0.5 * 111
            number = (start["id"]-1)*len(places)+end["id"]
            db.execute("INSERT OR IGNORE INTO simulation_services(from_id,to_id,route,headway,duration) VALUES(?,?,?,?,?)",
                       (start["id"],end["id"],f"SIM {number:02}",12+(number%3)*4,max(8,round(distance*3)+6)))
    if not db.execute("SELECT 1 FROM meta WHERE key='simulation_v1'").fetchone():
        db.execute("INSERT INTO meta(key,value) VALUES('simulation_v1','1')")
        audit(db,"NILAYA simulator","system","simulation.ready","Warangal simulation services initialized. Routes, timings and arrivals are simulated.","Simulation")


def simulation_route_stops(db: sqlite3.Connection, from_id: int, to_id: int, duration: int) -> list[dict]:
    """An illustrative corridor through real places, separate from official routes."""
    names = ["Warangal Fort", "Warangal Railway Station", "Warangal City Bus Station",
             "MGM Government Hospital", "Bhadrakali Temple", "Thousand Pillar Temple",
             "Hanamkonda City Bus Station", "Kazipet Bus Stop"]
    places = {row["name"]: dict(row) for row in db.execute("SELECT * FROM locations").fetchall()}
    corridor = [places[name] for name in names if name in places]
    ids = [place["id"] for place in corridor]
    if from_id in ids and to_id in ids:
        start, end = ids.index(from_id), ids.index(to_id)
        step = 1 if end > start else -1
        stops = [corridor[index] for index in range(start, end + step, step)]
    else:
        stops = [dict(row) for key in (from_id, to_id)
                 if (row := db.execute("SELECT * FROM locations WHERE id=?", (key,)).fetchone())]
    return [{"id": stop["id"], "name": stop["name"], "lat": stop["lat"], "lon": stop["lon"],
             "area": stop["area"], "category": stop["category"],
             "offset_minutes": round(duration * index / max(1, len(stops) - 1))}
            for index, stop in enumerate(stops)]


def simulation_departures(db: sqlite3.Connection, location_id: int, to_id: int = 0) -> list[dict]:
    sql = """SELECT s.*,a.name AS from_name,b.name AS to_name FROM simulation_services s
             JOIN locations a ON a.id=s.from_id JOIN locations b ON b.id=s.to_id WHERE s.from_id=?"""
    values = [location_id]
    if to_id:
        sql += " AND s.to_id=?"
        values.append(to_id)
    now = local_now()
    minute = int(now.timestamp()//60)
    entries = []
    for service in db.execute(sql,values).fetchall():
        headway = service["headway"]
        offset = service["id"] % headway
        next_minute = ((minute-offset)//headway+1)*headway+offset
        for slot in range(3 if to_id else 1):
            departure = datetime.fromtimestamp((next_minute+slot*headway)*60,now.tzinfo)
            arrival = departure+timedelta(minutes=service["duration"])
            eta = max(1,round((departure-now).total_seconds()/60))
            entries.append({"route":service["route"],"destination":service["to_name"],"headsign":service["to_name"],
                "from_stop":service["from_name"],"to_stop":service["to_name"],
                "departure":departure.strftime("%H:%M"),"arrival":arrival.strftime("%H:%M"),
                "time_label":departure.strftime("%H:%M"),"departure_at":departure.isoformat(),"arrival_at":arrival.isoformat(),
                "date":"Today · simulation","evidence":"Simulation","state":"Boarding soon" if eta<=4 else "On time",
                "eta_minutes":eta,"duration_minutes":service["duration"],"headway_minutes":headway,
                "stops":simulation_route_stops(db,location_id,service["to_id"],service["duration"]),
                "mode":"simulation"})
    return sorted(entries,key=lambda x:x["departure_at"])[:6]


def row_dict(row: sqlite3.Row) -> dict:
    return dict(row)


def as_int(value: object, default: int = 0) -> int:
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


def read_gtfs_csv(archive: zipfile.ZipFile, filename: str) -> list[dict[str, str]]:
    member = next((n for n in archive.namelist() if n.rsplit("/", 1)[-1].lower() == filename.lower()), None)
    if not member:
        return []
    with archive.open(member) as raw:
        text = io.TextIOWrapper(raw, encoding="utf-8-sig", newline="")
        return list(csv.DictReader(text))


def link_local_location(db: sqlite3.Connection, lat: float, lon: float) -> int | None:
    row = db.execute(
        """SELECT id, ((lat-?)*(lat-?)+(lon-?)*(lon-?)) AS d2 FROM locations
           WHERE ((lat-?)*(lat-?)+(lon-?)*(lon-?)) < 0.00010 ORDER BY d2 LIMIT 1""",
        (lat, lat, lon, lat, lat, lon),
    ).fetchone()
    return int(row["id"]) if row else None


def import_gtfs(raw: bytes, filename: str) -> dict:
    if len(raw) > MAX_IMPORT_BYTES:
        raise ValueError("The GTFS archive is larger than the 100 MB local import limit.")
    try:
        archive = zipfile.ZipFile(io.BytesIO(raw))
    except zipfile.BadZipFile as exc:
        raise ValueError("That file is not a readable GTFS ZIP archive.") from exc
    names = {n.rsplit("/", 1)[-1].lower() for n in archive.namelist()}
    if not {"stops.txt", "trips.txt", "stop_times.txt", "routes.txt"}.issubset(names):
        raise ValueError("This ZIP is missing one or more required GTFS files: routes.txt, trips.txt, stops.txt and stop_times.txt.")
    stops = []
    for row in read_gtfs_csv(archive, "stops.txt"):
        try:
            lat, lon = float(row.get("stop_lat", "")), float(row.get("stop_lon", ""))
        except ValueError:
            continue
        south, north, west, east = LOCAL_BOX
        if south <= lat <= north and west <= lon <= east and row.get("stop_id"):
            stops.append((row["stop_id"], row.get("stop_name", "Unnamed stop").strip(), lat, lon))
    if not stops:
        raise ValueError("The feed imported correctly, but it contains no stops in the Warangal tri-city area.")
    local_stop_ids = {r[0] for r in stops}
    routes = read_gtfs_csv(archive, "routes.txt")
    trips = read_gtfs_csv(archive, "trips.txt")
    local_trips = [t for t in trips if t.get("trip_id") and any(
        r.get("route_id") == t.get("route_id") for r in routes
    )]
    trip_ids = {t["trip_id"] for t in local_trips}
    times = []
    for row in read_gtfs_csv(archive, "stop_times.txt"):
        if row.get("stop_id") in local_stop_ids and row.get("trip_id") in trip_ids:
            times.append((row.get("trip_id", ""), row.get("stop_id", ""), row.get("arrival_time", ""),
                          row.get("departure_time", ""), as_int(row.get("stop_sequence"))))
    used_trip_ids = {r[0] for r in times}
    local_trips = [t for t in local_trips if t["trip_id"] in used_trip_ids]
    route_ids = {t.get("route_id", "") for t in local_trips}
    routes = [r for r in routes if r.get("route_id") in route_ids]
    if not times or not local_trips:
        raise ValueError("Warangal stops were found, but there are no linked trip times to show.")
    calendar = read_gtfs_csv(archive, "calendar.txt")
    calendar_dates = read_gtfs_csv(archive, "calendar_dates.txt")
    with db_session() as db:
        db.execute("BEGIN IMMEDIATE")
        db.execute("DELETE FROM gtfs_stop_times")
        db.execute("DELETE FROM gtfs_trips")
        db.execute("DELETE FROM gtfs_stops")
        db.execute("DELETE FROM gtfs_routes")
        db.execute("DELETE FROM gtfs_calendar")
        db.execute("DELETE FROM gtfs_calendar_dates")
        db.executemany(
            "INSERT INTO gtfs_stops(stop_id,stop_name,lat,lon,location_id) VALUES(?,?,?,?,?)",
            [(sid, name, lat, lon, link_local_location(db, lat, lon)) for sid, name, lat, lon in stops],
        )
        db.executemany(
            "INSERT INTO gtfs_routes(route_id,agency_id,short_name,long_name,route_type) VALUES(?,?,?,?,?)",
            [(r.get("route_id", ""), r.get("agency_id", ""), r.get("route_short_name", ""),
              r.get("route_long_name", ""), r.get("route_type", "")) for r in routes],
        )
        db.executemany(
            "INSERT INTO gtfs_trips(trip_id,route_id,service_id,headsign,direction_id) VALUES(?,?,?,?,?)",
            [(t.get("trip_id", ""), t.get("route_id", ""), t.get("service_id", ""),
              t.get("trip_headsign", ""), t.get("direction_id", "")) for t in local_trips],
        )
        db.executemany(
            "INSERT INTO gtfs_stop_times(trip_id,stop_id,arrival_time,departure_time,stop_sequence) VALUES(?,?,?,?,?)",
            times,
        )
        calendar_ids = {t.get("service_id", "") for t in local_trips}
        db.executemany(
            "INSERT INTO gtfs_calendar(service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date) VALUES(?,?,?,?,?,?,?,?,?,?)",
            [(r.get("service_id", ""), as_int(r.get("monday")), as_int(r.get("tuesday")), as_int(r.get("wednesday")),
              as_int(r.get("thursday")), as_int(r.get("friday")), as_int(r.get("saturday")), as_int(r.get("sunday")),
              r.get("start_date", "19000101"), r.get("end_date", "29991231")) for r in calendar if r.get("service_id") in calendar_ids],
        )
        db.executemany(
            "INSERT INTO gtfs_calendar_dates(service_id,service_date,exception_type) VALUES(?,?,?)",
            [(r.get("service_id", ""), r.get("date", ""), as_int(r.get("exception_type")))
             for r in calendar_dates if r.get("service_id") in calendar_ids],
        )
        imported = utc_now()
        db.execute("INSERT INTO gtfs_imports(imported_at,filename,local_stops,local_trips,source) VALUES(?,?,?,?,?)",
                   (imported, Path(filename).name, len(stops), len(local_trips), "Contains data provided by TGSRTC"))
        db.execute("INSERT OR REPLACE INTO meta(key,value) VALUES('gtfs_imported_at',?)", (imported,))
        db.execute("INSERT OR REPLACE INTO meta(key,value) VALUES('gtfs_filename',?)", (Path(filename).name,))
        audit(db, "Administrator", "admin", "gtfs.imported",
              f"Imported {len(stops)} Warangal-area stops and {len(local_trips)} local trips from {Path(filename).name}.",
              "Contains data provided by TGSRTC")
    return {"stops": len(stops), "trips": len(local_trips), "filename": Path(filename).name}


def service_runs(db: sqlite3.Connection, service_id: str, service_date: date) -> bool:
    key = service_date.strftime("%Y%m%d")
    exception = db.execute(
        "SELECT exception_type FROM gtfs_calendar_dates WHERE service_id=? AND service_date=?",
        (service_id, key),
    ).fetchone()
    if exception:
        return int(exception["exception_type"]) == 1
    row = db.execute("SELECT * FROM gtfs_calendar WHERE service_id=?", (service_id,)).fetchone()
    if not row:
        return False
    if not (row["start_date"] <= key <= row["end_date"]):
        return False
    weekday = ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")[service_date.weekday()]
    return bool(row[weekday])


def time_seconds(value: str) -> int | None:
    try:
        parts = [int(x) for x in value.split(":")]
        if len(parts) != 3:
            return None
        return parts[0] * 3600 + parts[1] * 60 + parts[2]
    except (TypeError, ValueError):
        return None


def short_time(value: str) -> str:
    secs = time_seconds(value)
    if secs is None:
        return value or "—"
    total_mins = secs // 60
    return f"{(total_mins // 60) % 24:02d}:{total_mins % 60:02d}"


def nearest_gtfs_stops(db: sqlite3.Connection, location_id: int, radius_m: float = 700) -> list[str]:
    location = db.execute("SELECT lat,lon FROM locations WHERE id=?", (location_id,)).fetchone()
    if not location:
        return []
    lat, lon = float(location["lat"]), float(location["lon"])
    # Equirectangular distance is adequate for selecting stops inside the city area.
    rows = db.execute(
        "SELECT stop_id,lat,lon FROM gtfs_stops WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?",
        (lat - 0.01, lat + 0.01, lon - 0.015, lon + 0.015),
    ).fetchall()
    found = []
    for row in rows:
        dx = (float(row["lon"]) - lon) * 111_320 * 0.953
        dy = (float(row["lat"]) - lat) * 111_320
        distance = (dx * dx + dy * dy) ** 0.5
        if distance <= radius_m:
            found.append((distance, row["stop_id"]))
    return [sid for _, sid in sorted(found)[:6]]


def departures_for_location(db: sqlite3.Connection, location_id: int, limit: int = 12) -> list[dict]:
    stop_ids = nearest_gtfs_stops(db, location_id)
    if not stop_ids:
        return []
    now = local_now()
    items: list[dict] = []
    placeholders = ",".join("?" for _ in stop_ids)
    query = f"""SELECT st.departure_time,st.arrival_time,s.stop_name,t.service_id,t.headsign,
                       r.short_name,r.long_name,r.route_type
                  FROM gtfs_stop_times st
                  JOIN gtfs_stops s ON s.stop_id=st.stop_id
                  JOIN gtfs_trips t ON t.trip_id=st.trip_id
                  JOIN gtfs_routes r ON r.route_id=t.route_id
                 WHERE st.stop_id IN ({placeholders})
                 ORDER BY st.departure_time LIMIT 350"""
    for row in db.execute(query, stop_ids).fetchall():
        departure = time_seconds(row["departure_time"])
        if departure is None:
            continue
        for service_date in (now.date() - timedelta(days=1), now.date(), now.date() + timedelta(days=1)):
            if not service_runs(db, row["service_id"], service_date):
                continue
            at = datetime.combine(service_date, datetime.min.time()).replace(tzinfo=now.tzinfo) + timedelta(seconds=departure)
            if at >= now:
                items.append({
                    "time": at.isoformat(), "time_label": short_time(row["departure_time"]),
                    "date_label": at.strftime("%a, %d %b"),
                    "route": row["short_name"] or row["long_name"] or "TGSRTC service",
                    "destination": row["headsign"] or row["long_name"] or "Destination not listed",
                    "stop_name": row["stop_name"], "evidence": "Published TGSRTC timetable",
                    "state": "Scheduled", "schedule_time": row["departure_time"],
                })
                break
        if len(items) >= limit:
            break
    items.sort(key=lambda x: x["time"])
    return items[:limit]


def journey_options(db: sqlite3.Connection, from_id: int, to_id: int, limit: int = 12) -> list[dict]:
    from_stops = nearest_gtfs_stops(db, from_id)
    to_stops = nearest_gtfs_stops(db, to_id)
    if not from_stops or not to_stops:
        return []
    left, right = ",".join("?" for _ in from_stops), ",".join("?" for _ in to_stops)
    sql = f"""SELECT a.trip_id,a.stop_id AS from_stop,a.departure_time,a.stop_sequence AS from_seq,
                     b.stop_id AS to_stop,b.arrival_time,b.stop_sequence AS to_seq,
                     t.service_id,t.headsign,r.short_name,r.long_name,
                     s1.stop_name AS from_name,s2.stop_name AS to_name
                FROM gtfs_stop_times a JOIN gtfs_stop_times b ON b.trip_id=a.trip_id AND b.stop_sequence>a.stop_sequence
                JOIN gtfs_trips t ON t.trip_id=a.trip_id JOIN gtfs_routes r ON r.route_id=t.route_id
                JOIN gtfs_stops s1 ON s1.stop_id=a.stop_id JOIN gtfs_stops s2 ON s2.stop_id=b.stop_id
               WHERE a.stop_id IN ({left}) AND b.stop_id IN ({right})
               ORDER BY a.departure_time LIMIT 500"""
    now = local_now()
    options = []
    for row in db.execute(sql, from_stops + to_stops).fetchall():
        seconds = time_seconds(row["departure_time"])
        if seconds is None:
            continue
        for service_date in (now.date() - timedelta(days=1), now.date(), now.date() + timedelta(days=1)):
            if not service_runs(db, row["service_id"], service_date):
                continue
            departure = datetime.combine(service_date, datetime.min.time()).replace(tzinfo=now.tzinfo) + timedelta(seconds=seconds)
            if departure < now:
                continue
            options.append({
                "route": row["short_name"] or row["long_name"] or "TGSRTC service",
                "headsign": row["headsign"] or row["long_name"] or "Destination not listed",
                "from_stop": row["from_name"], "to_stop": row["to_name"],
                "departure": short_time(row["departure_time"]), "arrival": short_time(row["arrival_time"]),
                "date": departure.strftime("%a, %d %b"), "evidence": "Published TGSRTC timetable",
                "state": "Scheduled; live arrival unavailable",
            })
            break
        if len(options) >= limit:
            break
    return options[:limit]


def operator_entries_for_location(db: sqlite3.Connection, location_id: int) -> list[dict]:
    now = local_now().isoformat(timespec="minutes")
    rows = db.execute(
        """SELECT o.*,l.name AS location_name FROM observations o JOIN locations l ON l.id=o.location_id
           WHERE o.location_id=? AND o.departure_at>=? ORDER BY o.departure_at LIMIT 12""",
        (location_id, now),
    ).fetchall()
    return [row_dict(r) for r in rows]


def location_rows(db: sqlite3.Connection) -> list[dict]:
    rows = db.execute("SELECT * FROM locations ORDER BY CASE category WHEN 'Bus station' THEN 0 WHEN 'Bus stop' THEN 1 WHEN 'Railway station' THEN 2 ELSE 3 END,name").fetchall()
    return [row_dict(r) for r in rows]


def active_announcements(db: sqlite3.Connection) -> list[dict]:
    now = utc_now()
    return [row_dict(r) for r in db.execute(
        """SELECT a.*,l.name AS location_name FROM announcements a LEFT JOIN locations l ON l.id=a.location_id
           WHERE a.status='active' AND a.starts_at<=? AND (a.ends_at IS NULL OR a.ends_at>=?) ORDER BY a.created_at DESC""",
        (now, now),
    ).fetchall()]


def expire_queue_holds(db: sqlite3.Connection) -> None:
    rows = db.execute("SELECT id,token,passenger_label FROM queue_tokens WHERE status='AWAY_PROTECTED' AND hold_expires_at<=?", (utc_now(),)).fetchall()
    if not rows:
        return
    db.executemany("UPDATE queue_tokens SET status='EXPIRED',updated_at=? WHERE id=?", [(utc_now(), r["id"]) for r in rows])
    for row in rows:
        audit(db, row["passenger_label"], "system", "queue.hold_expired", f"Demo token {row['token']} passed its ten-minute return window.", "Local demo queue")


def issue_token(role: str, username: str) -> str:
    token = secrets.token_urlsafe(32)
    with SESSION_LOCK:
        SESSIONS[token] = (role, time.time() + 12 * 60 * 60)
    return token


class Handler(BaseHTTPRequestHandler):
    server_version = "NILAYA-local/1.0"

    def log_message(self, fmt: str, *args: object) -> None:
        return

    def respond(self, body: object, status: int = 200, content_type: str = "application/json; charset=utf-8") -> None:
        if content_type.startswith("application/json"):
            raw = json.dumps(body, ensure_ascii=False).encode("utf-8")
        elif isinstance(body, bytes):
            raw = body
        else:
            raw = str(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(raw)

    def body(self, limit: int = 2_000_000) -> bytes:
        length = as_int(self.headers.get("Content-Length"), 0)
        if length <= 0 or length > limit:
            raise ValueError("The request is empty or larger than the local limit.")
        return self.rfile.read(length)

    def json_body(self) -> dict:
        try:
            data = json.loads(self.body().decode("utf-8"))
            if not isinstance(data, dict):
                raise ValueError
            return data
        except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as exc:
            raise ValueError("Enter the information in the requested fields and try again.") from exc

    def authorized(self, role: str) -> tuple[str, str] | None:
        header = self.headers.get("Authorization", "")
        token = header.removeprefix("Bearer ").strip()
        with SESSION_LOCK:
            session = SESSIONS.get(token)
            if session and session[1] < time.time():
                SESSIONS.pop(token, None)
                session = None
        return session if session and session[0] == role else None

    def require(self, role: str) -> tuple[str, str] | None:
        session = self.authorized(role)
        if not session:
            self.respond({"error": "Sign in again to continue."}, HTTPStatus.UNAUTHORIZED)
        return session

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        q = parse_qs(parsed.query)
        try:
            if path == "/api/health":
                with db_session() as db:
                    feed = db.execute("SELECT imported_at,filename,local_stops,local_trips FROM gtfs_imports ORDER BY id DESC LIMIT 1").fetchone()
                self.respond({"ok": True, "product": PRODUCT, "feed": row_dict(feed) if feed else None, "data_file": str(DB_PATH), "mode": "simulation"})
                return
            with db_session() as db:
                if path == "/api/locations":
                    self.respond({"locations": location_rows(db)})
                elif path == "/api/services":
                    location_id = as_int(q.get("from_id", [0])[0])
                    services = db.execute(
                        """SELECT s.route,s.to_id,s.headway,s.duration,l.name,l.area,l.aliases
                           FROM simulation_services s JOIN locations l ON l.id=s.to_id
                           WHERE s.from_id=? ORDER BY l.name""", (location_id,)).fetchall()
                    self.respond({"services": [dict(row) for row in services], "mode": "simulation"})
                elif path == "/api/announcements":
                    self.respond({"announcements": active_announcements(db)})
                elif path == "/api/departures":
                    location_id = as_int(q.get("location_id", [0])[0])
                    self.respond({"departures": simulation_departures(db, location_id), "source": "Simulation"})
                elif path == "/api/journey":
                    a, b = as_int(q.get("from_id", [0])[0]), as_int(q.get("to_id", [0])[0])
                    self.respond({"options": simulation_departures(db, a, b), "operator_entries": operator_entries_for_location(db, a), "state": "simulation", "mode": "simulation"})
                elif path == "/api/queue":
                    expire_queue_holds(db)
                    rows = db.execute(
                        """SELECT q.*,l.name AS location_name FROM queue_tokens q JOIN locations l ON l.id=q.location_id
                           WHERE q.status NOT IN ('BOARDED','CANCELLED','EXPIRED') ORDER BY q.sequence_no"""
                    ).fetchall()
                    self.respond({"tokens": [row_dict(r) for r in rows]})
                elif path == "/api/board":
                    location_id = as_int(q.get("location_id", [0])[0])
                    departures = simulation_departures(db, location_id)
                    observed = db.execute(
                        """SELECT o.*,l.name AS location_name FROM observations o JOIN locations l ON l.id=o.location_id
                           WHERE o.location_id=? AND o.departure_at>=? ORDER BY o.departure_at LIMIT 12""",
                        (location_id, local_now().isoformat(timespec="minutes")),
                    ).fetchall()
                    self.respond({"departures": departures, "observations": [row_dict(r) for r in observed], "announcements": active_announcements(db)})
                elif path == "/api/admin/summary":
                    if not self.require("admin"):
                        return
                    expire_queue_holds(db)
                    counts = {
                        "locations": db.execute("SELECT COUNT(*) FROM locations").fetchone()[0],
                        "passenger_searches": db.execute("SELECT COUNT(*) FROM activity WHERE action='passenger.search'").fetchone()[0],
                        "active_queue": db.execute("SELECT COUNT(*) FROM queue_tokens WHERE status IN ('WAITING','AWAY_PROTECTED','CALLED')").fetchone()[0],
                        "active_announcements": db.execute("SELECT COUNT(*) FROM announcements WHERE status='active'").fetchone()[0],
                        "local_trips": db.execute("SELECT COUNT(*) FROM simulation_services").fetchone()[0],
                    }
                    feed = db.execute("SELECT * FROM gtfs_imports ORDER BY id DESC LIMIT 1").fetchone()
                    self.respond({"counts": counts, "feed": row_dict(feed) if feed else None, "data_path": str(DB_PATH)})
                elif path == "/api/admin/activity":
                    if not self.require("admin"):
                        return
                    rows = db.execute("SELECT * FROM activity ORDER BY id DESC LIMIT 100").fetchall()
                    self.respond({"activity": [row_dict(r) for r in rows]})
                elif path == "/api/admin/locations":
                    if not self.require("admin"):
                        return
                    self.respond({"locations": location_rows(db)})
                elif path == "/api/admin/users":
                    if not self.require("admin"):
                        return
                    rows = db.execute("SELECT username,display_name,role,enabled FROM users ORDER BY role,username").fetchall()
                    self.respond({"users": [row_dict(r) for r in rows]})
                elif path == "/api/operator/queue":
                    if not self.require("operator"):
                        return
                    expire_queue_holds(db)
                    rows = db.execute(
                        """SELECT q.*,l.name AS location_name FROM queue_tokens q JOIN locations l ON l.id=q.location_id
                           WHERE q.status NOT IN ('BOARDED','CANCELLED','EXPIRED') ORDER BY q.sequence_no"""
                    ).fetchall()
                    self.respond({"tokens": [row_dict(r) for r in rows]})
                elif path == "/api/operator/observations":
                    if not self.require("operator"):
                        return
                    rows = db.execute(
                        """SELECT o.*,l.name AS location_name FROM observations o JOIN locations l ON l.id=o.location_id
                           ORDER BY o.id DESC LIMIT 50"""
                    ).fetchall()
                    self.respond({"observations": [row_dict(r) for r in rows]})
                else:
                    self.serve_static(path)
        except ValueError as exc:
            self.respond({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
        except Exception as exc:
            self.respond({"error": f"Local data error: {exc}"}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        try:
            if path == "/api/auth/login":
                payload = self.json_body()
                username = str(payload.get("username", "")).strip().lower()
                password = str(payload.get("password", ""))
                wanted_role = str(payload.get("role", ""))
                with db_session() as db:
                    user = db.execute("SELECT * FROM users WHERE username=? AND enabled=1", (username,)).fetchone()
                    if not user or user["role"] != wanted_role or not verify_password(password, user["salt"], user["password_hash"]):
                        self.respond({"error": "Those sign-in details do not match this role."}, HTTPStatus.UNAUTHORIZED)
                        return
                    audit(db, user["display_name"], user["role"], user["role"] + ".login", "Signed in to the local " + user["role"] + " app.", "Local account")
                self.respond({"token": issue_token(user["role"], username), "name": user["display_name"], "role": user["role"]})
            elif path == "/api/passenger/search":
                payload = self.json_body()
                from_id, to_id = as_int(payload.get("from_id")), as_int(payload.get("to_id"))
                with db_session() as db:
                    start = db.execute("SELECT name FROM locations WHERE id=?", (from_id,)).fetchone()
                    finish = db.execute("SELECT name FROM locations WHERE id=?", (to_id,)).fetchone()
                    if not start or not finish or from_id == to_id:
                        raise ValueError("Choose two different Warangal locations.")
                    detail = f"{start['name']} → {finish['name']}"
                    audit(db, "Passenger", "passenger", "passenger.search", detail, "Passenger app")
                    options = simulation_departures(db, from_id, to_id)
                    entries = operator_entries_for_location(db, from_id)
                self.respond({"options": options, "operator_entries": entries, "journey": detail, "state": "simulation", "mode": "simulation"})
            elif path == "/api/passenger/queue":
                payload = self.json_body()
                action = str(payload.get("action", ""))
                token_id = as_int(payload.get("token_id"))
                expired = False
                with db_session() as db:
                    if action == "join":
                        location_id = as_int(payload.get("location_id"))
                        label = str(payload.get("label", "Passenger")).strip()[:32] or "Passenger"
                        location = db.execute("SELECT category FROM locations WHERE id=?", (location_id,)).fetchone()
                        if not location or location["category"] not in {"Bus station", "Bus stop"}:
                            raise ValueError("Choose a real Warangal bus stop first.")
                        next_seq = int(db.execute("SELECT COALESCE(MAX(sequence_no),0)+1 FROM queue_tokens").fetchone()[0])
                        token = "WG-" + secrets.token_hex(2).upper()
                        now = utc_now()
                        cur = db.execute("INSERT INTO queue_tokens(token,passenger_label,location_id,sequence_no,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
                                         (token,label,location_id,next_seq,"WAITING",now,now))
                        token_id = int(cur.lastrowid)
                        audit(db, label, "passenger", "queue.joined", f"Joined demo queue {token} at sequence {next_seq}.", "Local demo queue")
                    elif action == "break":
                        token_row = db.execute("SELECT * FROM queue_tokens WHERE id=?", (token_id,)).fetchone()
                        if not token_row or token_row["status"] != "WAITING":
                            raise ValueError("Only a waiting token can start a break.")
                        expiry = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(timespec="seconds")
                        db.execute("UPDATE queue_tokens SET status='AWAY_PROTECTED',hold_expires_at=?,updated_at=? WHERE id=?", (expiry,utc_now(),token_id))
                        audit(db, token_row["passenger_label"], "passenger", "queue.break_started", f"Demo token {token_row['token']} has a ten-minute return window.", "Local demo queue")
                    elif action == "return":
                        token_row = db.execute("SELECT * FROM queue_tokens WHERE id=?", (token_id,)).fetchone()
                        if not token_row or token_row["status"] != "AWAY_PROTECTED":
                            raise ValueError("There is no protected break for that token.")
                        if token_row["hold_expires_at"] and token_row["hold_expires_at"] < utc_now():
                            db.execute("UPDATE queue_tokens SET status='EXPIRED',updated_at=? WHERE id=?", (utc_now(),token_id))
                            audit(db, token_row["passenger_label"], "system", "queue.hold_expired", f"Demo token {token_row['token']} passed its ten-minute return window.", "Local demo queue")
                            expired = True
                        else:
                            db.execute("UPDATE queue_tokens SET status='WAITING',hold_expires_at=NULL,updated_at=? WHERE id=?", (utc_now(),token_id))
                            audit(db, token_row["passenger_label"], "passenger", "queue.returned", f"Demo token {token_row['token']} returned in its protected window.", "Local demo queue")
                    else:
                        raise ValueError("Choose a queue action.")
                    result = db.execute("SELECT q.*,l.name AS location_name FROM queue_tokens q JOIN locations l ON l.id=q.location_id WHERE q.id=?", (token_id,)).fetchone()
                if expired:
                    self.respond({"error": "The ten-minute demo return window has ended. Ask the operator for help."}, HTTPStatus.CONFLICT)
                    return
                self.respond({"token": row_dict(result)})
            elif path == "/api/operator/announcement":
                session = self.require("operator")
                if not session:
                    return
                payload = self.json_body()
                title = str(payload.get("title", "")).strip()[:100]
                message = str(payload.get("message", "")).strip()[:500]
                severity = str(payload.get("severity", "info"))
                location_id = as_int(payload.get("location_id")) or None
                if not title or not message or severity not in {"info", "delay", "access", "cancel"}:
                    raise ValueError("Add a short title and message, then choose an update type.")
                now = utc_now()
                ends_at = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat(timespec="seconds")
                with db_session() as db:
                    cur = db.execute("INSERT INTO announcements(title,message,severity,location_id,starts_at,ends_at,created_by,created_at,source) VALUES(?,?,?,?,?,?,?,?,?)",
                                     (title,message,severity,location_id,now,ends_at,session[1],now,"Operator-entered; confirm on site"))
                    loc = db.execute("SELECT name FROM locations WHERE id=?", (location_id,)).fetchone() if location_id else None
                    audit(db, session[1], "operator", "operator.announcement", f"{title}: {message}" + (f" · {loc['name']}" if loc else ""), "Operator-entered")
                    item = db.execute("SELECT a.*,l.name AS location_name FROM announcements a LEFT JOIN locations l ON l.id=a.location_id WHERE a.id=?", (cur.lastrowid,)).fetchone()
                self.respond({"announcement": row_dict(item)})
            elif path == "/api/operator/announcement/close":
                session = self.require("operator")
                if not session:
                    return
                payload = self.json_body()
                ann_id = as_int(payload.get("id"))
                with db_session() as db:
                    row = db.execute("SELECT title FROM announcements WHERE id=? AND status='active'", (ann_id,)).fetchone()
                    if not row:
                        raise ValueError("That update is already closed or was removed.")
                    db.execute("UPDATE announcements SET status='closed',ends_at=? WHERE id=?", (utc_now(),ann_id))
                    audit(db, session[1], "operator", "operator.announcement_closed", f"Closed update: {row['title']}", "Operator-entered")
                self.respond({"ok": True})
            elif path == "/api/operator/observation":
                session = self.require("operator")
                if not session:
                    return
                payload = self.json_body()
                location_id = as_int(payload.get("location_id"))
                route = str(payload.get("route", "")).strip()[:80]
                destination = str(payload.get("destination", "")).strip()[:120]
                departure = str(payload.get("departure_at", "")).strip()
                note = str(payload.get("note", "")).strip()[:240]
                try:
                    dt = datetime.fromisoformat(departure)
                except ValueError as exc:
                    raise ValueError("Choose a valid local departure time.") from exc
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=local_now().tzinfo)
                if not route or not destination or dt < local_now() - timedelta(minutes=5):
                    raise ValueError("Enter the route, destination and a current or future time.")
                with db_session() as db:
                    if not db.execute("SELECT 1 FROM locations WHERE id=?", (location_id,)).fetchone():
                        raise ValueError("Choose a Warangal location.")
                    cur = db.execute("INSERT INTO observations(location_id,route_label,destination,departure_at,note,entered_by,entered_at,source) VALUES(?,?,?,?,?,?,?,?)",
                                     (location_id,route,destination,dt.isoformat(timespec="minutes"),note,session[1],utc_now(),"Operator-entered; not a live vehicle feed"))
                    loc = db.execute("SELECT name FROM locations WHERE id=?", (location_id,)).fetchone()
                    audit(db, session[1], "operator", "operator.observation", f"Entered {route} toward {destination} at {dt.strftime('%H:%M')} · {loc['name']}", "Operator-entered; not a live feed")
                    row = db.execute("SELECT o.*,l.name AS location_name FROM observations o JOIN locations l ON l.id=o.location_id WHERE o.id=?", (cur.lastrowid,)).fetchone()
                self.respond({"observation": row_dict(row)})
            elif path == "/api/operator/queue-action":
                session = self.require("operator")
                if not session:
                    return
                payload = self.json_body()
                token_id = as_int(payload.get("token_id"))
                action = str(payload.get("action", ""))
                transitions = {"call": ("WAITING","CALLED"), "board": ("CALLED","BOARDED")}
                if action not in transitions:
                    raise ValueError("Choose call or board for this token.")
                before, after = transitions[action]
                with db_session() as db:
                    row = db.execute("SELECT * FROM queue_tokens WHERE id=?", (token_id,)).fetchone()
                    if not row or row["status"] != before:
                        raise ValueError("This token changed in another app. Refresh the queue before trying again.")
                    now = utc_now()
                    db.execute("UPDATE queue_tokens SET status=?,updated_at=?,called_at=CASE WHEN ?='CALLED' THEN ? ELSE called_at END WHERE id=?",
                               (after,now,after,now,token_id))
                    audit(db, session[1], "operator", f"queue.{action}", f"{row['token']} marked {after} by operator.", "Local demo queue")
                self.respond({"ok": True, "status": after})
            elif path == "/api/admin/import-gtfs":
                session = self.require("admin")
                if not session:
                    return
                length = as_int(self.headers.get("Content-Length"), 0)
                if length <= 0 or length > MAX_IMPORT_BYTES:
                    raise ValueError("Choose a GTFS ZIP file under 100 MB.")
                raw = self.rfile.read(length)
                filename = self.headers.get("X-Filename", "tgsrtc-gtfs.zip")
                result = import_gtfs(raw, filename)
                self.respond({"ok": True, **result})
            elif path == "/api/admin/add-location":
                session = self.require("admin")
                if not session:
                    return
                payload = self.json_body()
                name = str(payload.get("name", "")).strip()[:100]
                category = str(payload.get("category", "Place")).strip()[:40]
                lat, lon = float(payload.get("lat", 0)), float(payload.get("lon", 0))
                area = str(payload.get("area", "Warangal")).strip()[:80]
                if not name or not (17.7 <= lat <= 18.3 and 79.2 <= lon <= 80.0):
                    raise ValueError("Use a name and coordinates within the Warangal district area.")
                with db_session() as db:
                    db.execute("INSERT INTO locations(name,category,lat,lon,area,source,updated_at) VALUES(?,?,?,?,?,?,?)",
                               (name,category,lat,lon,area,"Administrator-entered; verify before passenger use",utc_now()))
                    audit(db, session[1], "admin", "location.added", f"Added {name} to the local place list.", "Administrator-entered")
                    item = db.execute("SELECT * FROM locations WHERE name=?", (name,)).fetchone()
                self.respond({"location": row_dict(item)})
            elif path == "/api/demo/run-scenario":
                payload = self.json_body()
                action = str(payload.get("action", ""))
                with db_session() as db:
                    if action == "passenger-search":
                        a = db.execute("SELECT id,name FROM locations WHERE name='Warangal City Bus Station'").fetchone()
                        b = db.execute("SELECT id,name FROM locations WHERE name='Thousand Pillar Temple'").fetchone()
                        audit(db, "Walkthrough passenger", "passenger", "passenger.search",
                              f"Example walkthrough: {a['name']} → {b['name']}", "Simulated demo scenario")
                    elif action == "operator-notice":
                        now = utc_now()
                        loc = db.execute("SELECT id,name FROM locations WHERE name='Hanamkonda City Bus Station'").fetchone()
                        db.execute("INSERT INTO announcements(title,message,severity,location_id,starts_at,created_by,created_at,source) VALUES(?,?,?,?,?,?,?,?)",
                                   ("Walkthrough notice", "Training notice only. No TGSRTC service change is being reported.", "info", loc["id"], now, "Walkthrough operator", now, "Simulated demo scenario"))
                        audit(db, "Walkthrough operator", "operator", "operator.announcement", f"Training notice at {loc['name']}; no real service change.", "Simulated demo scenario")
                    elif action == "clear-demo":
                        db.execute("DELETE FROM announcements WHERE source='Simulated demo scenario'")
                        db.execute("DELETE FROM activity WHERE source='Simulated demo scenario'")
                        audit(db, "Demo controller", "demo", "demo.cleared", "Removed walkthrough-only activity and notices.", "Demo controller")
                    else:
                        raise ValueError("Choose a walkthrough action.")
                self.respond({"ok": True})
            else:
                self.respond({"error": "This local action is not available."}, HTTPStatus.NOT_FOUND)
        except ValueError as exc:
            self.respond({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
        except sqlite3.IntegrityError as exc:
            self.respond({"error": "That value already exists or does not match a Warangal location."}, HTTPStatus.CONFLICT)
        except Exception as exc:
            self.respond({"error": f"Local data error: {exc}"}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def serve_static(self, path: str) -> None:
        if path in {"/", "/index.html"}:
            file = WEB_ROOT / "index.html"
        elif path == "/app.css":
            file = WEB_ROOT / "app.css"
        elif path == "/app.js":
            file = WEB_ROOT / "app.js"
        elif path in {"/journey.js", "/journey.css"}:
            file = WEB_ROOT / Path(path).name
        elif path in {"/fonts/Geist.ttf", "/fonts/GeistMono.ttf"}:
            file = ROOT / "assets" / "fonts" / Path(path).name
        else:
            self.respond({"error": "Page not found."}, HTTPStatus.NOT_FOUND)
            return
        if not file.exists():
            self.respond({"error": "The local app files are missing."}, HTTPStatus.NOT_FOUND)
            return
        content_type = "text/html; charset=utf-8" if file.suffix == ".html" else "text/css; charset=utf-8" if file.suffix == ".css" else "text/javascript; charset=utf-8" if file.suffix == ".js" else "font/ttf"
        self.respond(file.read_bytes(), content_type=content_type)


def launch_ui(role: str, url: str, stop_server: callable) -> None:
    try:
        import tkinter as tk
        from tkinter import messagebox
        from tkinter import font as tkfont
    except Exception:
        webbrowser.open(url)
        try:
            while True:
                time.sleep(3600)
        except KeyboardInterrupt:
            stop_server()
        return
    try:
        # Set a stable Tcl/Tk app class instead of deriving it from the frozen
        # executable name.
        root = tk.Tk(className="NILAYA")
        root.title(f"NILAYA · {role.title()}")
        root.geometry("400x190")
        root.resizable(False, False)
        root.configure(bg="#050505")
        # Named Tk fonts keep multiword family names intact in Tcl. Passing
        # "Segoe UI" as a raw option string makes some Tk versions parse UI as
        # a numeric font field and abort widget creation.
        body_font = tkfont.Font(root=root, family="Segoe UI", size=10)
        small_font = tkfont.Font(root=root, family="Segoe UI", size=9)
        heading_font = tkfont.Font(root=root, family="Segoe UI", size=16, weight="bold")
        tk.Label(root, text=f"NILAYA  /  {role.title()}", bg="#050505", fg="#f5f7f9", font=heading_font).pack(anchor="w", padx=22, pady=(20, 4))
        tk.Label(root, text="The app is open in your browser.", bg="#050505", fg="#a3afb8", font=body_font).pack(anchor="w", padx=22)
        tk.Label(root, text="Keep this window open while using NILAYA.", bg="#050505", fg="#71808a", font=small_font).pack(anchor="w", padx=22, pady=(2, 14))
        controls = tk.Frame(root, bg="#050505")
        controls.pack(fill="x", padx=22)
        tk.Button(controls, text="Reopen app", command=lambda: webbrowser.open(url), bg="#182126", fg="#f5f7f9", activebackground="#26343b", activeforeground="#f5f7f9", relief="flat", padx=14, pady=8).pack(side="left")

        def close() -> None:
            if messagebox.askyesno("Close NILAYA", "Close this local app and its browser connection?"):
                stop_server()
                root.destroy()

        tk.Button(controls, text="Close app", command=close, bg="#f2f2f2", fg="#0a0a0a", activebackground="#e23d19", activeforeground="#ffffff", relief="flat", padx=14, pady=8).pack(side="right")
        root.protocol("WM_DELETE_WINDOW", close)
        root.after(600, lambda: webbrowser.open(url))
        root.mainloop()
    except tk.TclError:
        # Keep the local service usable if Windows cannot create its optional
        # launcher window for any reason.
        try:
            root.destroy()
        except Exception:
            pass
        webbrowser.open(url)
        try:
            while True:
                time.sleep(3600)
        except KeyboardInterrupt:
            stop_server()


def main() -> None:
    role = "passenger"
    args = [arg for arg in sys.argv[1:] if not arg.startswith("--")]
    exe_name = Path(sys.executable).stem.lower()
    for key in ROLES:
        if key in exe_name:
            role = key
            break
    if args and args[0] in ROLES:
        role = args[0]
    initialize_database()
    try:
        dev_server = "--serve" in sys.argv
        bind_port = as_int(os.environ.get("NILAYA_DEV_PORT"), 8765) if dev_server else 0
        httpd = ThreadingHTTPServer(("127.0.0.1", bind_port), Handler)
    except OSError as exc:
        raise SystemExit(f"Could not start NILAYA's local connection: {exc}")
    httpd.daemon_threads = True
    port = httpd.server_address[1]
    url = f"http://127.0.0.1:{port}/?role={role}"
    if "--serve" in sys.argv:
        print(f"NILAYA local demo: http://127.0.0.1:{port}/?role=passenger", flush=True)
        print(f"Shared database: {DB_PATH}", flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            httpd.shutdown()
            httpd.server_close()
        return
    worker = threading.Thread(target=httpd.serve_forever, name="NILAYA local server", daemon=True)
    worker.start()
    def stop() -> None:
        try:
            httpd.shutdown()
            httpd.server_close()
        except Exception:
            pass
    launch_ui(role, url, stop)


if __name__ == "__main__":
    main()

