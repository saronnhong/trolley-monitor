import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline";

const routeUrl = new URL("../data/blue-line.json", import.meta.url);
const route = JSON.parse(await readFile(routeUrl, "utf8"));

const routeLengthMeters =
    route.stations[route.stations.length - 1].distanceFromStartMeters;

function createTrain(id, direction, cruiseSpeed) {
    const orderedStations =
        direction === "UTC"
            ? route.stations
            : [...route.stations].reverse();

    return {
        id,
        direction,
        cruiseSpeed,
        speed: 0,
        positionMeters: orderedStations[0].distanceFromStartMeters,
        movement: "stopped",
        currentStation: orderedStations[0].name,
        orderedStations,
        nextStationIndex: 1,
        departAt: Date.now() + 5000,
        connected: true,
    };
}

const trains = [
    createTrain("blue-01", "UTC", 32),
    createTrain("blue-02", "San Ysidro", 24),
];

let previousTick = Date.now();

async function sendReadings() {
    const now = Date.now();
    const elapsedSeconds = (now - previousTick) / 1000;
    previousTick = now;

    for (const train of trains) {
        if (train.movement === "finished") {
            continue;
        }

        if (train.movement === "stopped") {
            if (now >= train.departAt) {
                train.movement = "moving";
                train.currentStation = null;
                train.speed = train.cruiseSpeed;
            }

            continue;
        }

        const nextStation = train.orderedStations[train.nextStationIndex];
        const targetPosition = nextStation.distanceFromStartMeters;

        const distanceRemaining = Math.abs(
            targetPosition - train.positionMeters
        );

        const distanceMoved = (train.speed / 3.6) * elapsedSeconds;

        if (distanceMoved >= distanceRemaining) {
            train.positionMeters = targetPosition;
            train.speed = 0;
            train.currentStation = nextStation.name;
            train.nextStationIndex += 1;

            const reachedEnd =
                train.nextStationIndex >= train.orderedStations.length;

            train.movement = reachedEnd ? "finished" : "stopped";
            train.departAt = now + 5000;
        } else {
            const directionMultiplier = train.direction === "UTC" ? 1 : -1;

            train.positionMeters += distanceMoved * directionMultiplier;
        }
    }

    await Promise.all(
        trains.filter(train => train.connected).map(async train => {
            try {
                const response = await fetch(
                    "http://localhost:3001/api/readings",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            id: train.id,
                            direction: train.direction,
                            speed: train.speed,
                            positionMeters: train.positionMeters,
                            movement: train.movement,
                            currentStation: train.currentStation,
                        }),
                        signal: AbortSignal.timeout(5000),
                    }
                );

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

            } catch (err) {
                console.error(`Failed to send ${train.id}: ${err.message}`);
            }
        })
    );

    setTimeout(sendReadings, 2000);
}
const terminal = createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("Commands: toggle blue-01, toggle blue-02, status");

terminal.on("line", input => {
  const [command, trainId] = input.trim().split(/\s+/);

  if (command === "status") {
    console.table(
      trains.map(train => ({
        id: train.id,
        connected: train.connected,
        movement: train.movement,
        positionMeters: Math.round(train.positionMeters),
      }))
    );

    return;
  }

  if (command !== "toggle") {
    console.log("Use: toggle blue-01, toggle blue-02, or status");
    return;
  }

  const train = trains.find(train => train.id === trainId);

  if (!train) {
    console.log(`Unknown train: ${trainId}`);
    return;
  }

  train.connected = !train.connected;

  console.log(
    `${train.id} tracker ${train.connected ? "connected" : "disconnected"}`
  );
});

sendReadings();