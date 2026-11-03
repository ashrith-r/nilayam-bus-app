# NILAYA · Warangal local demo

NILAYA demonstrates connected passenger and staff workflows around real Warangal place names. It is a local simulation with approximate map coordinates, an illustrative street schematic and stop corridors, synthetic SIM services, recurring departure times, and illustrative journey durations and boarding windows. These are not official routes, live arrival predictions, or verified boarding directions.

## Platform

A local Python server and shared SQLite database support a plain HTML, CSS, and JavaScript frontend. PyInstaller packages five Windows EXEs: Passenger, Operator, Admin, Stop Display, and Demo Controller. Each opens its role in the browser and connects locally on `127.0.0.1`. Apps under the same Windows account share `%LOCALAPPDATA%\NILAYA\demo.sqlite3`, unless `NILAYA_DATA_DIR` selects another folder. Core workflows work offline; external source and map links require internet access.

Voice search and read-aloud depend on browser support, permissions, and available recognition or voices. Typed search remains available. The passenger language toggle is a partial Telugu preview; some place names, metadata, utilities, and staff screens remain in English.

## Users and tasks

- Passengers select an origin and search destinations by place name, alias, area, or SIM number. They compare arrival ranges, IST boarding windows, ride times, headways, ordered stops, and later services; explore the schematic or stop list with pan, zoom, fit, and an expanded map; save and reopen trips in browser localStorage; request journey or boarding-stop speech; and join or manage a shared demonstration queue token with a timed break. Destination shortcuts and the full places disclosure support browsing.
- Operators sign in to publish or close shared notices, enter departures, call queue tokens, and confirm boarding.
- Administrators sign in to review shared activity and counts, manage places, inspect demo accounts, and import GTFS reference data.
- Stop Display presents simulated departures, operator-entered times, shared notices, and queue state; it refreshes every 20 seconds and keeps its own selected boarding location.
- Demo Controller creates clearly labeled practice search and notice records and clears its walkthrough records.

## Data and evidence

Synthetic service definitions persist in SQLite and generate recurring departures in IST. Passenger searches, notices, entered departures, and queue activity are shared through that database and visible in Admin. Saved journeys remain local to the passenger browser origin rather than synchronizing across roles.

The passenger arrival range and two-minute boarding window are generated demonstrations. Real place names do not validate corridor order, street geometry, stop timing, or the bus marker as transport guidance. An existing queue token remains associated with its actual station when the passenger changes journey origin; its summary and management controls retain that station.

Passenger and Stop Display use simulation data in this build. The Admin GTFS importer stores official timetable files separately as reference data; importing a file does not switch the demonstration screens to an official feed. Retain required source attribution when using imported data. Queue protection is a demonstration and does not establish a real staffed-terminal policy or boarding promise. Seeded staff accounts are intended for the local demo.

## Visual direction

The approved Operate UI / Modern Dark direction uses opaque graphite surfaces, white primary actions, restrained mint state signals, and bundled Geist and Geist Mono fonts. DESIGN.md records the implemented system. Role workflows and clear simulation labels are durable product constraints.

