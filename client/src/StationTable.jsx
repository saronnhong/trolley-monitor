import Table from "react-bootstrap/Table";

function formatMiles(meters) {
  return (meters / 1609.344).toFixed(2);
}

function StationTable({ stations }) {
  return (
    <Table responsive striped hover className="align-middle mb-0">
      <thead>
        <tr>
          <th scope="col">#</th>
          <th scope="col">Station</th>
          <th scope="col">From previous station (mi)</th>
          <th scope="col">From San Ysidro (mi)</th>
        </tr>
      </thead>

      <tbody>
        {stations.map((station, index) => (
          <tr key={station.id}>
            <td>{index + 1}</td>
            <td>{station.name}</td>
            <td>
              {index === 0
                ? "—"
                : formatMiles(station.distanceFromPreviousMeters)}
            </td>
            <td>
              {formatMiles(station.distanceFromStartMeters)}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export default StationTable;