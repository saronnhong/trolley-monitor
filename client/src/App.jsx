import { useState, useEffect } from "react";
import Badge from "react-bootstrap/Badge";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import Container from "react-bootstrap/Container";
import Table from "react-bootstrap/Table";
import StationTable from "./StationTable";


function TrainTable({ trains, onSelectTrain }) {
  return (
    <div>
      <Table responsive hover className="align-middle mb-0">
        <thead>
          <tr>
            <th>Train</th>
            <th>Direction</th>
            <th>Next station</th>
            <th>Distance remaining</th>
            <th>Speed</th>
            <th>Movement</th>
            <th>Status</th>
            <th>Details</th>
          </tr>
        </thead>

        <tbody>
          {trains.map(train => (
            <tr key={train.id}>
              <td>{train.id}</td>
              <td>{train.direction}</td>
              <td>{train.nextStation}</td>
              <td>
                {(train.distanceToNextStationMeters / 1000).toFixed(2)} km
              </td>
              <td>{train.speed} km/h</td>
              <td>
                {train.movement === "moving"
                  ? "Moving"
                  : train.movement === "finished"
                    ? `Arrived at ${train.currentStation}`
                    : `Stopped at ${train.currentStation}`}
              </td>
              <td>
                <Badge
                  bg={
                    train.status === "online"
                      ? "success"
                      : train.status === "stale"
                        ? "warning"
                        : "secondary"
                  }
                  text={train.status === "stale" ? "dark" : undefined}
                >
                  {train.status}
                </Badge>
              </td>
              <Button
                variant="outline-primary"
                size="sm"
                onClick={() => onSelectTrain(train.id)}
              >
                Select
              </Button>
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="small text-secondary mt-3 mb-0">
        Offline and stale trackers show their last known readings.
      </p>
    </div>
  );
}

function App() {
  const [trains, setTrains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTrainId, setSelectedTrainId] = useState(null);

  const selectedTrain = trains.find(
    train => train.id === selectedTrainId
  );

  useEffect(() => {
    const controller = new AbortController();
    let timerId;

    async function loadTrains() {
      try {
        const response = await fetch("/api/trains", {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Could not load trains (${response.status})`);
        }

        const data = await response.json();

        if (!controller.signal.aborted) {
          setTrains(data);
          setError("");
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          timerId = setTimeout(loadTrains, 3000);
        }
      }
    }

    loadTrains();

    return () => {
      controller.abort();
      clearTimeout(timerId);
    };
  }, []);

  const [route, setRoute] = useState(null);
  const [routeLoading, setRouteLoading] = useState(true);
  const [routeError, setRouteError] = useState("");
  useEffect(() => {
    const controller = new AbortController();

    async function loadRoute() {
      try {
        const response = await fetch("/api/routes/510", {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Could not load route (${response.status})`);
        }

        const data = await response.json();

        if (!controller.signal.aborted) {
          setRoute(data);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setRouteError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setRouteLoading(false);
        }
      }
    }

    loadRoute();

    return () => controller.abort();
  }, []);

  return (
    <Container as="main" className="py-5">
      <header className="mb-4">
        <Badge bg="primary" className="mb-2">
          Blue Line
        </Badge>

        <h1>San Diego Trolley Monitor</h1>

        <p className="text-secondary">
          Simulated train tracking using real San Diego routes.
        </p>
      </header>

      <Card className="shadow-sm mb-4">
        <Card.Header as="h2" className="h5 py-3">
          Train status
        </Card.Header>

        <Card.Body>
          {error && (
            <p role="alert" className="text-danger">
              {error}. Displayed readings may be out of date.
            </p>
          )}

          {loading ? (
            <p className="mb-0">Loading trains...</p>
          ) : trains.length === 0 ? (
            <p className="mb-0">No train readings available.</p>
          ) : (
            <TrainTable
              trains={trains}
              onSelectTrain={setSelectedTrainId}
            />
          )}
        </Card.Body>
      </Card>

      <Card className="shadow-sm">
        <Card.Body>
          {selectedTrain ? (
            <>
              <h2 className="h5">
                Selected train: {selectedTrain.id}
              </h2>
              <p>Heading toward {selectedTrain.direction}</p>
              <p className="mb-0">
                Speed: {selectedTrain.speed} km/h
              </p>
            </>
          ) : (
            <p className="text-secondary mb-0">
              Select a train to see its details.
            </p>
          )}
        </Card.Body>
      </Card>

      <Card className="shadow-sm mt-4">
        <Card.Header as="h2" className="h5 py-3">
          Blue Line stations — San Ysidro to UTC
        </Card.Header>

        <Card.Body>
          {routeLoading ? (
            <p className="mb-0">Loading stations...</p>
          ) : routeError ? (
            <p role="alert" className="text-danger mb-0">
              {routeError}
            </p>
          ) : route ? (
            <>
              <p className="text-secondary">
                {route.stations.length} stations. Distances use MTS route data.
              </p>

              <StationTable stations={route.stations} />
            </>
          ) : (
            <p className="mb-0">No route available.</p>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
}

export default App;