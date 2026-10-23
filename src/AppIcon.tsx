import {
  Sparkles,
  LibraryBig,
  NotebookPen,
  FileInput,
  MapPin,
  Dumbbell,
  Cloud,
  Users,
  Footprints,
  Target,
  CalendarDays,
  Sunrise,
  CloudRain,
  Wind,
  Snowflake,
  Sun,
  Thermometer,
  Timer,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Speech,
  ListChecks,
  SlidersHorizontal,
  Search,
  Landmark,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
const icons: Record<string, LucideIcon> = {
  builder: Sparkles,
  library: LibraryBig,
  mine: NotebookPen,
  markdown: FileInput,
  aos: MapPin,
  exicon: Dumbbell,
  data: Cloud,
  pax: Users,
  group: Users,
  running: Footprints,
  focus: Target,
  date: CalendarDays,
  light: Sunrise,
  Rain: CloudRain,
  Wind,
  "Snow / ice": Snowflake,
  Hot: Sun,
  Cold: Thermometer,
  timer: Timer,
  play: Play,
  pause: Pause,
  reset: RotateCcw,
  beeps: Volume2,
  off: VolumeX,
  voice: Speech,
  details: SlidersHorizontal,
  search: Search,
  landmark: Landmark,
  review: ShieldCheck,
  sheet: ListChecks,
};
/** Decorative icons always accompany real text; accessible names stay stable. */
export function AppIcon({ name, size = 18 }: { name: string; size?: number }) {
  const Icon = icons[name] ?? ListChecks;
  return (
    <Icon
      className="app-icon"
      size={size}
      strokeWidth={1.8}
      aria-hidden="true"
      focusable="false"
    />
  );
}
