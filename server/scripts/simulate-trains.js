import { readFile } from "node:fs/promises";

const routeUrl = new URL("../data/blue-line.json", import.meta.url);
const route = JSON.parse(await readFile(routeUrl, "utf8"));

const routeLengthMeters =
  route.stations[route.stations.length - 1].distanceFromStartMeters;

const trains = [
  { id: "blue-01", speed: 32, positionMeters: 0 },
  { id: "blue-02", speed: 24, positionMeters: 10000 },
];

let previousTick = Date.now();

async function sendReadings() {
  const now = Date.now();
  const elapsedSeconds = (now - previousTick) / 1000;
  previousTick = now;

  for (const train of trains) {
    train.positionMeters = Math.min(
      train.positionMeters + (train.speed / 3.6) * elapsedSeconds,
      routeLengthMeters
    );

    if (train.positionMeters >= routeLengthMeters) {
      train.speed = 0;
    }
  }

  await Promise.all(
    trains.map(async train => {
      try {
        const response = await fetch(
          "http://localhost:3001/api/readings",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(train),
            signal: AbortSignal.timeout(5000),
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        console.log(`Sent reading for ${train.id}`);
      } catch (err) {
        console.error(`Failed to send ${train.id}: ${err.message}`);
      }
    })
  );

  setTimeout(sendReadings, 2000);
}

sendReadings();