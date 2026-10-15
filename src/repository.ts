import { catalog } from "./catalog";
import { workoutSchema, type Workout } from "./model";
export interface CatalogRepository {
  list(signal?: AbortSignal): Promise<Workout[]>;
}
export class BundledCatalog implements CatalogRepository {
  async list() {
    return structuredClone(catalog);
  }
}
/** Read-only adapter. Only a publishable/anon key belongs in a browser build. */
export class SupabaseCatalog implements CatalogRepository {
  constructor(
    private url: string,
    private publishableKey: string,
  ) {}
  async list(signal?: AbortSignal) {
    const base = new URL(this.url);
    if (base.protocol !== "https:") throw Error("Catalog URL must use HTTPS.");
    const response = await fetch(
      new URL(
        "/rest/v1/workouts?select=data&published=eq.true&order=id.asc&limit=500",
        base,
      ),
      { signal, headers: { apikey: this.publishableKey } },
    );
    if (!response.ok) throw Error("Shared catalog is unavailable.");
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) throw Error("Invalid catalog response.");
    const workouts = rows.map((row) => {
      const w = workoutSchema.parse(row.data);
      if (w.kind !== "source")
        throw Error(
          "Personal records cannot be published through this adapter.",
        );
      return w;
    });
    if (new Set(workouts.map((w) => w.id)).size !== workouts.length)
      throw Error("Duplicate shared IDs.");
    return workouts;
  }
}
