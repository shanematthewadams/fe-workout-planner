import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type MouseEvent,
} from "react";
import { flushSync } from "react-dom";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { AppIcon } from "./AppIcon";
import { routeHash } from "./navigation";

const groups = [
  {
    label: "Workouts",
    items: [
      ["builder", "Build"],
      ["library", "Library"],
      ["mine", "My Workouts"],
    ],
  },
  {
    label: "Tools & resources",
    items: [
      ["markdown", "Import a workout"],
      ["aos", "AO Directory"],
      ["exicon", "Exicon & Lexicon"],
      ["data", "Saving & recovery"],
    ],
  },
];

export function AppNavigation({
  active,
  onNavigate,
  accountEntry,
}: {
  active: string;
  accountEntry?: (onOpen: () => void) => ReactNode;
  onNavigate: (destination: string) => boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const shell = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!expanded) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExpanded(false);
        toggle.current?.focus();
      }
    };
    const outside = (event: PointerEvent) => {
      if (!shell.current?.contains(event.target as Node)) setExpanded(false);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", outside);
    };
  }, [expanded]);
  const navigate = (
    event: MouseEvent<HTMLAnchorElement>,
    destination: string,
  ) => {
    // Keep normal link behavior for opening a destination in a new tab.
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    open(destination);
  };
  const open = (destination: string) => {
    let accepted = false;
    flushSync(() => {
      accepted = onNavigate(destination);
      if (accepted) setExpanded(false);
    });
    if (accepted) {
      const content =
        destination === "data"
          ? (document.getElementById("account-heading") ??
            document.getElementById("main"))
          : document.getElementById("main");
      content?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
  };
  return (
    <header
      ref={shell}
      className="app-navigation no-print"
      data-expanded={expanded}
    >
      <div className="navigation-heading">
        <a
          className="navigation-brand"
          href="#build"
          onClick={(event) => navigate(event, "builder")}
        >
          <span>F3QBuilder</span>
        </a>
        <button
          ref={toggle}
          type="button"
          className="navigation-toggle"
          aria-expanded={expanded}
          aria-controls="planner-navigation"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <X size={20} aria-hidden="true" />
          ) : (
            <Menu size={20} aria-hidden="true" />
          )}
          {expanded ? "Close" : "Menu"}
        </button>
      </div>
      <nav
        id="planner-navigation"
        className="navigation-links"
        aria-label="Planner navigation"
      >
        {groups.map((group) => (
          <div className="navigation-group" key={group.label}>
            <p className="navigation-label">{group.label}</p>
            {group.items.map(([key, label]) => (
              <a
                key={key}
                href={routeHash({ tab: key })}
                aria-current={active === key ? "page" : undefined}
                onClick={(event) => navigate(event, key)}
              >
                <AppIcon name={key} size={20} />
                <span>{label}</span>
                {active === key && (
                  <ArrowUpRight
                    className="navigation-current"
                    size={16}
                    aria-hidden="true"
                  />
                )}
              </a>
            ))}
          </div>
        ))}
        {accountEntry?.(() => open("data"))}
      </nav>
    </header>
  );
}
