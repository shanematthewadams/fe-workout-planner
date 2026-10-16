import { createServer } from "vite";
import { writeFile } from "node:fs/promises";
const server = await createServer({
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const { starters } = await server.ssrLoadModule("/src/catalog.ts");
  const quote = (s) => "'" + s.replaceAll("'", "''") + "'";
  const sql =
    "-- Original illustrative starters. Dedicated FE project only.\n" +
    starters
      .map(
        (w) =>
          `insert into public.workouts (id,data,approved,published) values (${quote(w.id)},${quote(JSON.stringify(w))}::jsonb,true,true) on conflict (id) do nothing;`,
      )
      .join("\n") +
    "\n";
  await writeFile(new URL("../docs/starter-seed.sql", import.meta.url), sql);
  console.log(`${starters.length} starters; existing IDs preserved.`);
} finally {
  await server.close();
}
