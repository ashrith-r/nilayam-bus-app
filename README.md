# NILAYA — Warangal Transit Demo

NILAYA is a locally running, multi-role transit information prototype set in Warangal, Telangana. It includes Passenger, Operator, Stop Display, Administrator, and Demo Controller screens that share one local SQLite database.

> **Simulation only:** Warangal place names are real, but service routes, headways, arrival times, travel durations, and vehicle positions are illustrative demo data. NILAYA does not provide live TGSRTC tracking, verified timetables, or navigation guidance.

## Features

- **Passenger:** search by place, landmark alias, area, or SIM service number; view a trip summary and stop sequence; explore an illustrative map or stop list; save trips; and manage a demo queue token.
- **Operator:** publish or close service notices, enter departures, and call or confirm queue tokens.
- **Stop Display:** show simulated departures, operator-entered departures, service notices, and queue information for a selected station.
- **Administrator:** review demo activity and manage locations, accounts, and imported GTFS reference data.
- **Demo Controller:** add and clear practice searches and notices for a walkthrough.

## Build and run on Windows

Requirements: Windows, Python 3.12 or later, and an internet connection to install PyInstaller.

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install pyinstaller
powershell -ExecutionPolicy Bypass -File .\build.ps1
```

The five one-file executables are written to `release-journey\`. Run the role apps you need from that folder. Each app opens in your default browser; keep its small NILAYA launcher window open while using it.

| App | Sign-in |
| --- | --- |
| Passenger | No sign-in |
| Stop Display | No sign-in |
| Demo Controller | No sign-in |
| Administrator | `admin` / `NilayaDemo!2026` |
| Operator | `operator` / `NilayaDemo!2026` |

These are intentionally public classroom-demo credentials. Do not reuse them or use this prototype with real passenger information.

All role apps should run on the same Windows PC and Windows account to share the local database. NILAYA binds to `127.0.0.1`; these executables do not create a hosted service or synchronize with other computers. The database is stored at `%LOCALAPPDATA%\NILAYA\demo.sqlite3` by default. Set `NILAYA_DATA_DIR` before launch to use a different local folder.

## Data and limitations

The seeded places include Warangal City Bus Station, Hanamkonda City Bus Station, Kazipet Bus Stop, Warangal Railway Station, Thousand Pillar Temple, Bhadrakali Temple, Warangal Fort, and MGM Government Hospital. Map locations are approximate and the route drawing is illustrative; check locations on site before relying on them for wayfinding.

SIM services and arrival times are generated for demonstration. Publishing an operator delay notice shares the notice with Passenger and Stop Display, but does not recalculate the simulated ETA. Voice search depends on browser support. There is no live vehicle feed, validated arrival prediction, or field-tested queue policy in this prototype.

Sources, attribution, and data notes are listed in [SOURCES.md](SOURCES.md). The bundled Geist and Geist Mono fonts include their license files in `assets/fonts/`.

## Project notes

The source is organized into `src/` (Python local server and SQLite), `web/` (HTML, CSS, and JavaScript interface), and `assets/` (fonts). Product overview and design notes are in [PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md).

No project reuse license has been selected yet. Until a `LICENSE` file is added, public availability of the repository should not be read as permission to reuse or redistribute the project.

