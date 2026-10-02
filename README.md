# San Diego Trolley Monitor

A React and Node.js dashboard that monitors simulated trains on San Diego’s Blue Line using real MTS stations and route distances.

The project demonstrates a device-to-server telemetry flow: simulated trackers send readings to a REST API, and a React dashboard polls the backend to display the latest information and detect missing updates.

**Route data is real. Train positions, speeds, and connection events are simulated.** This is an independent learning project, not an official MTS application or an operational train-control system.

## Features

- Blue Line station table with 32 stops from San Ysidro to UTC.
- Distances between stations and cumulative distance from San Ysidro.
- Simulated northbound and southbound trains.
- Constant-speed movement, station stops, and terminal arrivals.
- Train selection with a details panel.
- Online, stale, and offline tracker indicators.
- Individual tracker disconnect/reconnect commands while trains continue moving.
- Responsive tables and cards using React Bootstrap.
- Input validation and dashboard handling of backend connection errors.

## Technology

- React, JavaScript, and Vite
- React Bootstrap and Bootstrap
- Node.js and Express
- csv-parse for importing MTS GTFS data
- Local JSON route data and in-memory train readings

## Data flow

1. A separate Node simulator advances trains along the route.
2. Connected trackers send JSON readings to `POST /api/readings`.
3. Express validates each reading and stores the latest one per train ID.
4. React requests `GET /api/trains` and displays the results.
5. The backend calculates connection status from the time since the last received reading.

The simulator waits two seconds after each sending cycle before beginning another. The dashboard waits three seconds after each request finishes before requesting again. Requests have their own duration, so these are not exact fixed-frequency updates.

## Project structure

```text
trolley-monitor/
  client/
    src/
      App.jsx
      StationTable.jsx
      index.css
      main.jsx
    vite.config.js
  server/
    index.js
    data/
      blue-line.json
      mts-gtfs.zip
      gtfs/
    scripts/
      inspect-routes.js
      inspect-blue-line.js
      simulate-trains.js
```

`TrainTable` is currently defined inside `App.jsx`.

## Getting started

### Requirements

- Node.js 24 (developed with v24.6.0)
- npm
- `curl` and `unzip` if regenerating the route data

### Install dependencies

From the project root:

```bash
cd client
npm install
```

In a separate terminal, from the project root:

```bash
cd server
npm install
```

### Prepare route data

If `server/data/blue-line.json` is already included, skip this section.

From `server`:

```bash
mkdir -p data/gtfs
curl -L --fail https://www.sdmts.com/google_transit_files/google_transit.zip -o data/mts-gtfs.zip
unzip -o data/mts-gtfs.zip -d data/gtfs
node scripts/inspect-routes.js
node scripts/inspect-blue-line.js
```

The importer selects a Blue Line trip with the most stops and writes `data/blue-line.json`. The downloaded snapshot used during development identifies the Blue Line as route `510`.

### Run the application

Keep three terminal sessions running.

**Terminal 1 — API**, from `server`:

```bash
npm run dev
```

The API listens on `http://localhost:3001`.

**Terminal 2 — frontend**, from `client`:

```bash
npm run dev
```

Open the URL printed by Vite. The development proxy forwards `/api` requests to the backend.

**Terminal 3 — simulator**, from `server`:

```bash
node scripts/simulate-trains.js
```

The train table remains empty until the backend receives readings.

## Simulator commands

Enter these commands in the simulator terminal and press Enter:

| Command | Action |
| --- | --- |
| `toggle blue-01` | Disconnect or reconnect the first tracker |
| `toggle blue-02` | Disconnect or reconnect the second tracker |
| `status` | Print simulator connection, movement, and position information |

Disconnecting a tracker stops its messages but does not stop the simulated train. Reconnecting sends its current position on the next sending cycle.

## Tracker status

| Status | Time since last reading |
| --- | --- |
| Online | Less than 6 seconds |
| Stale | At least 6 seconds, but less than 15 seconds |
| Offline | At least 15 seconds |

Status changes appear on the dashboard’s next successful poll. Stale and offline trains retain their last reported position, speed, and movement. These values do not describe their current state with certainty.

Tracker connection status is separate from train movement: a stopped train can have an online tracker.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Backend health response |
| GET | `/api/routes/510` | Blue Line route and station distances |
| GET | `/api/trains` | Latest readings, calculated status, and next-station information |
| POST | `/api/readings` | Validate and store a simulated tracker reading |

Example reading:

```json
{
  "id": "blue-01",
  "direction": "UTC",
  "speed": 32,
  "positionMeters": 1000,
  "movement": "moving",
  "currentStation": null
}
```

Directions are `UTC` or `San Ysidro`. Movement values are `moving`, `stopped`, or `finished`. Speed is in km/h; route positions are in meters measured from San Ysidro. The backend adds a server receipt timestamp and rejects invalid readings with HTTP 400.

## Route data and distances

Data comes from [MTS’s developer resources](https://www.sdmts.com/business-center/app-developers) and is subject to the terms linked there.

The importer uses `routes.txt`, `trips.txt`, `stop_times.txt`, `stops.txt`, and `shapes.txt`. For the development snapshot, supplied cumulative distances were inferred to be miles.

These are approximate route distances, not surveyed measurements. Southbound simulation reverses the northbound station distances rather than importing separate southbound track geometry.

## Limitations

- Readings are stored in memory and reset when the backend restarts.
- Restarting the simulator resets train positions.
- Trains use constant cruise speeds, approximate five-second station stops, and no acceleration or braking model.
- Trains stop at their destination; return trips are not automatic.
- No live MTS vehicle feed, authentication, persistent database, or map is included.
- The Vite proxy is a development configuration; production hosting requires API routing configuration.
