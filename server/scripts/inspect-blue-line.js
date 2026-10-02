import { readFile, writeFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";

async function readGtfs(filename) {
  const fileUrl = new URL(`../data/gtfs/${filename}`, import.meta.url);
  const contents = await readFile(fileUrl, "utf8");

  return parse(contents, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  });
}

const [trips, stopTimes, stops] = await Promise.all([
  readGtfs("trips.txt"),
  readGtfs("stop_times.txt"),
  readGtfs("stops.txt"),
]);

// Find the trips that belong to the Blue Line.
const blueTrips = trips.filter(trip => trip.route_id === "510");

const blueTripIds = new Set(
  blueTrips.map(trip => trip.trip_id)
);

// Group each Blue Line trip's stop records together.
const stopsByTrip = new Map();

for (const stopTime of stopTimes) {
  if (!blueTripIds.has(stopTime.trip_id)) {
    continue;
  }

  if (!stopsByTrip.has(stopTime.trip_id)) {
    stopsByTrip.set(stopTime.trip_id, []);
  }

  stopsByTrip.get(stopTime.trip_id).push(stopTime);
}

// Choose a trip with the most stops.
const fullTrip = blueTrips.reduce((best, trip) => {
  const count = stopsByTrip.get(trip.trip_id)?.length ?? 0;
  const bestCount = stopsByTrip.get(best.trip_id)?.length ?? 0;

  return count > bestCount ? trip : best;
});

// Put its stops in travel order.
const orderedStopTimes = [
  ...(stopsByTrip.get(fullTrip.trip_id) ?? []),
].sort(
  (a, b) => Number(a.stop_sequence) - Number(b.stop_sequence)
);

const stopsById = new Map(
  stops.map(stop => [stop.stop_id, stop])
);

console.log("Selected trip:", fullTrip.trip_id);
console.log("Destination:", fullTrip.trip_headsign);
console.log("Shape:", fullTrip.shape_id);

console.table(
  orderedStopTimes.map(stopTime => {
    const stop = stopsById.get(stopTime.stop_id);

    return {
      sequence: Number(stopTime.stop_sequence),
      station: stop?.stop_name ?? stopTime.stop_id,
      latitude: stop?.stop_lat,
      longitude: stop?.stop_lon,
      shapeDistance: stopTime.shape_dist_traveled || "not provided",
    };
  })
);

const shapes = await readGtfs("shapes.txt");

const routePoints = shapes
  .filter(point => point.shape_id === fullTrip.shape_id)
  .sort(
    (a, b) =>
      Number(a.shape_pt_sequence) - Number(b.shape_pt_sequence)
  );

function distanceMeters(pointA, pointB) {
  const toRadians = degrees => degrees * Math.PI / 180;
  const earthRadius = 6371000;

  const latA = toRadians(Number(pointA.shape_pt_lat));
  const latB = toRadians(Number(pointB.shape_pt_lat));

  const latitudeDifference = latB - latA;
  const longitudeDifference = toRadians(
    Number(pointB.shape_pt_lon) - Number(pointA.shape_pt_lon)
  );

  const a =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(latA) *
    Math.cos(latB) *
    Math.sin(longitudeDifference / 2) ** 2;

  return earthRadius * 2 *
    Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

let routeLengthMeters = 0;

for (let index = 1; index < routePoints.length; index++) {
  routeLengthMeters += distanceMeters(
    routePoints[index - 1],
    routePoints[index]
  );
}

const firstStop = orderedStopTimes[0];
const lastStop = orderedStopTimes[orderedStopTimes.length - 1];

const suppliedDistance =
  Number(lastStop.shape_dist_traveled) -
  Number(firstStop.shape_dist_traveled);

console.log({
  routeLengthKm: (routeLengthMeters / 1000).toFixed(2),
  routeLengthMiles: (routeLengthMeters / 1609.344).toFixed(2),
  suppliedDistance,
});

const stations = orderedStopTimes.map((stopTime, index) => {
  const stop = stopsById.get(stopTime.stop_id);

  const distanceMiles = Number(stopTime.shape_dist_traveled);

  const previousDistanceMiles =
    index === 0
      ? distanceMiles
      : Number(orderedStopTimes[index - 1].shape_dist_traveled);

  return {
    id: stopTime.stop_id,
    sequence: Number(stopTime.stop_sequence),
    name: stop.stop_name,
    latitude: Number(stop.stop_lat),
    longitude: Number(stop.stop_lon),
    distanceFromStartMeters: distanceMiles * 1609.344,
    distanceFromPreviousMeters:
      (distanceMiles - previousDistanceMiles) * 1609.344,
  };
});

const blueLine = {
  id: "510",
  name: "Blue Line",
  direction: fullTrip.trip_headsign,
  shapeId: fullTrip.shape_id,
  distanceSource: "MTS GTFS; distance units inferred as miles",
  stations,
};

const outputUrl = new URL("../data/blue-line.json", import.meta.url);

await writeFile(
  outputUrl,
  JSON.stringify(blueLine, null, 2),
  "utf8"
);

console.log("Saved data/blue-line.json");