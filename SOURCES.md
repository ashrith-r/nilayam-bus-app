# Data sources and limits

Checked 3 November 2026.

## Bus data

- [TGSRTC Open Data](https://www.tgsrtc.telangana.gov.in/open-data) states that static schedules, routes and stops are published in GTFS. The page currently sends users to a request form and says the download link is emailed. It also requires the attribution “Contains data provided by TGSRTC”, says the data is provided as available, and prohibits implying TGSRTC endorsement.
- [TGSRTC Gamyam](https://play.google.com/store/apps/details?id=com.tsrtc) is the official passenger-facing live tracking app. No authorized public developer endpoint for its live positions was found during this build. NILAYA therefore displays no live arrival estimate.
- This build runs a labeled simulation. SIM route labels, service frequencies, travel durations, arrival states and departure times are synthetic. Place names reference real Warangal locations. The simulation does not represent TGSRTC schedules or vehicle positions. Imported official GTFS remains separate reference data.

## Place names and context

- [TGSRTC booking/service page](https://www.tgsrtc.telangana.gov.in/reservation-booking-service-home) lists Warangal among its Telangana connections.
- [TGSRTC open data](https://www.tgsrtc.telangana.gov.in/open-data) is the route/stop source for names such as Warangal and Hanamkonda bus stations when a GTFS file is available.
- [Warangal District · Warangal Fort](https://warangal.telangana.gov.in/tourist-place/warangal-fort/) identifies the fort as a local landmark and describes access from the nearest bus station and railway station.
- [Telangana Tourism · Thousand Pillar Temple](https://tourism.telangana.gov.in/attractions/thousand-pillars-temple) places the temple in Hanamkonda.
- [Telangana Tourism · Warangal](https://www.tourism.telangana.gov.in/page/warangal) identifies Warangal Fort, Thousand Pillar Temple and other city landmarks.
- [MGM Government Hospital](https://www.mgmwarangal.com/contact.html) gives the hospital address at MGM Circle, Warangal.
- Map/place data is attributed to [OpenStreetMap contributors](https://www.openstreetmap.org/copyright). Some seed points use nearby bus-stop or station reference coordinates from OpenStreetMap-based listings. Coordinates are approximate and should be checked on-site before printing wayfinding or publishing directions.

## What the demo does not claim

- It does not claim TGSRTC partnership or endorsement.
- It does not report bus positions, delay estimates or predicted arrival windows.
- It does not claim the seed locations represent approved boarding bays or pedestrian routes.
- The queue and walkthrough activity are local demonstration records, not passenger records or staffed public service.

## Journey map and intermediate stops

The passenger workspace uses an illustrative corridor through Warangal Fort, Warangal Railway Station, Warangal City Bus Station, MGM Government Hospital, Bhadrakali Temple, Thousand Pillar Temple, Hanamkonda City Bus Station and Kazipet Bus Stop. The ordered stops, street background, bus marker, boarding window and travel durations are simulation content. They do not identify an official bus route, approved boarding bay or surveyed street geometry.

