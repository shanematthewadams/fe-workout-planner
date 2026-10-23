/** Import only the explicit roster column, never report authors or amenity-review status. */
export function importSiteQRoster(
  values: string[][],
  local: { id: string; name: string }[],
  firstRow = 4,
) {
  const header = values[0] ?? [];
  const aoColumn = header.indexOf("AO"),
    nameColumn = header.indexOf("Site Q(s)");
  if (aoColumn < 0 || nameColumn < 0)
    throw Error("AO and Site Q(s) headers are required.");
  const normalize = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const roster: Record<string, { names: string[]; sourceRows: number[] }> = {};
  for (const [index, row] of values.slice(1).entries()) {
    const ao = row[aoColumn]?.trim(),
      value = row[nameColumn]?.trim();
    if (!ao) continue;
    const matches = local.filter(
      (item) => normalize(item.name) === normalize(ao),
    );
    if (matches.length !== 1)
      throw Error(`AO roster identity needs review: ${ao}`);
    const unknown =
      !value || /^(unknown|pending|not confirmed|tbd)$/i.test(value);
    const names = unknown
      ? []
      : [
          ...new Set(
            value
              .split(";")
              .map((name) => name.trim())
              .filter(Boolean),
          ),
        ];
    if ((!unknown && !names.length) || names.some((name) => name.length > 80))
      throw Error(`Check Site Q names for ${ao}.`);
    const existing = roster[matches[0].id];
    const signature = (items: string[]) =>
      items.map(normalize).sort().join("|");
    if (existing && signature(existing.names) !== signature(names))
      throw Error(`Conflicting venue rosters for ${ao}; review before import.`);
    roster[matches[0].id] = {
      names: existing?.names ?? names,
      sourceRows: [...(existing?.sourceRows ?? []), firstRow + index + 1],
    };
  }
  return roster;
}
