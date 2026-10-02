import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";

const routesFile = new URL("../data/gtfs/routes.txt", import.meta.url);

const contents = await readFile(routesFile, "utf8");

const routes = parse(contents, {
  columns: true,
  skip_empty_lines: true,
  bom: true,
});

const trolleyRoutes = routes.filter(
  route => route.route_type === "0"
);

console.table(
  trolleyRoutes.map(route => ({
    id: route.route_id,
    name: route.route_short_name,
    description: route.route_long_name,
  }))
);