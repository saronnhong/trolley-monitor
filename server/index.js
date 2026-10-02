import express from "express";
import { readFile } from "node:fs/promises";

const app = express();
const PORT = 3001;

app.use(express.json());

app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        message: "Trolley backend is running",
    });
});

const blueLineUrl = new URL("./data/blue-line.json", import.meta.url);

const blueLine = JSON.parse(
    await readFile(blueLineUrl, "utf8")
);

const stations = blueLine.stations;
const routeLengthMeters =
    stations[stations.length - 1].distanceFromStartMeters;

// const trains = [
//   {
//     id: "blue-01",
//     direction: "UTC",
//     speed: 32,
//     positionMeters: 0,
//     status: "online",
//   },
//   {
//     id: "blue-02",
//     direction: "UTC",
//     speed: 24,
//     positionMeters: 10000,
//     status: "online",
//   },
// ];
const trains = new Map();

let previousTick = Date.now();

setInterval(() => {
    const now = Date.now();
    const elapsedSeconds = (now - previousTick) / 1000;
    previousTick = now;

    for (const train of trains) {
        const metersPerSecond = train.speed / 3.6;

        train.positionMeters = Math.min(
            train.positionMeters + metersPerSecond * elapsedSeconds,
            routeLengthMeters
        );

        if (train.positionMeters >= routeLengthMeters) {
            train.speed = 0;
        }
    }
}, 1000);

app.get("/api/trains", (req, res) => {
    const now = Date.now();

    const readings = [...trains.values()].map(train => {
        const ageSeconds = (now - train.receivedAt) / 1000;

        const status =
            ageSeconds >= 15
                ? "offline"
                : ageSeconds >= 6
                    ? "stale"
                    : "online";

        const nextStation = stations.find(
            station =>
                station.distanceFromStartMeters > train.positionMeters
        );

        return {
            ...train,
            status,
            nextStation: nextStation?.name ?? "End of line",
            distanceToNextStationMeters: nextStation
                ? nextStation.distanceFromStartMeters - train.positionMeters
                : 0,
        };
    });

    res.json(readings);
});

app.get("/api/routes/510", (req, res) => {
    res.json(blueLine);
});

app.post("/api/readings", (req, res) => {
    const { id, speed, positionMeters } = req.body ?? {};

    if (
        typeof id !== "string" ||
        id.trim() === "" ||
        !Number.isFinite(speed) ||
        speed < 0 ||
        !Number.isFinite(positionMeters) ||
        positionMeters < 0 ||
        positionMeters > routeLengthMeters
    ) {
        return res.status(400).json({
            error: "A valid id, speed, and route position are required",
        });
    }

    const reading = {
        id: id.trim(),
        direction: "UTC",
        speed,
        positionMeters,
        receivedAt: Date.now(),
    };

    trains.set(reading.id, reading);

    res.status(200).json({ message: "Reading received" });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});