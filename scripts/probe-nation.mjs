import { probeNation } from "./nation-probe.mjs";
// Optional diagnostics never block the independent library build.
console.log(
  "FE_SOURCE_PROBE " + JSON.stringify(await probeNation(process.env)),
);
