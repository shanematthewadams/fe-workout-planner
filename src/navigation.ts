export const routeTabs = {
  builder: "build",
  library: "library",
  mine: "my-workouts",
  aos: "aos",
  exicon: "guide",
  data: "settings",
  markdown: "import",
} as const;
export type AppRoute = {
  tab: string;
  view?: "workout" | "edit" | "lead";
  id?: string;
};
export function readRoute(hash = location.hash): AppRoute {
  const [path, id] = hash.replace(/^#\/?/, "").split("/");
  const tab = Object.entries(routeTabs).find(
    ([, value]) => value === path,
  )?.[0];
  if (tab) return { tab };
  if (
    ["workout", "edit", "lead"].includes(path) &&
    id &&
    /^[\w-]{1,100}$/.test(id)
  )
    return { tab: "mine", view: path as AppRoute["view"], id };
  return { tab: "builder" };
}
export function routeHash(route: AppRoute) {
  return route.view && route.id && /^[\w-]{1,100}$/.test(route.id)
    ? `#${route.view}/${route.id}`
    : `#${routeTabs[route.tab as keyof typeof routeTabs] ?? "build"}`;
}
export function writeRoute(route: AppRoute, replace = false) {
  const hash = routeHash(route);
  if (location.hash === hash) return;
  history[replace ? "replaceState" : "pushState"]({ feRoute: route }, "", hash);
}
