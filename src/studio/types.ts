export type FitnessGoal =
  | "cardio-endurance"
  | "upper-body"
  | "legs-hills"
  | "core-abs"
  | "full-body-grit"
  | "ruck-strength"
  | "high-intensity-hiit";

export type EquipmentType =
  | "none"
  | "cindy-coupons"
  | "ruck-vest"
  | "pullup-bar"
  | "bleachers-stairs"
  | "cones"
  | "dumbbells-kettlebells";

export type WorkoutStyle =
  | "dora-123"
  | "the-11s"
  | "four-corners"
  | "route-66"
  | "iron-hulk"
  | "deck-of-death"
  | "circuit-grinder"
  | "tabata-beatdown"
  | "iron-pax-challenge";

export type TerrainLocation =
  | "parking-lot"
  | "grass-field"
  | "track-bleachers"
  | "playground-park"
  | "covered-shelter"
  | "hills-incline";

export interface ExerciseItem {
  id: string;
  name: string;
  f3Name: string;
  cadence: "IC" | "OYO" | "Timed"; // In Cadence vs On Your Own
  repsOrDuration: string;
  targetArea: "Warm-up" | "Upper" | "Lower" | "Core" | "Full Body" | "Cardio";
  equipmentNeeded?: string;
  notes?: string;
  cadenceCallout?: string;
}

export interface WorkoutSection {
  title: string;
  subtitle: string;
  f3Term: string; // e.g. "Warm-o-Rama / COP", "The Thang", "Mary", "COT"
  durationMinutes: number;
  timeRange: string; // e.g. "0:00 - 0:08"
  description: string;
  exercises: ExerciseItem[];
  instructions?: string[];
  mumbleChatterPrompt?: string;
}

export interface F3Workout {
  id: string;
  title: string;
  aoName?: string;
  theme: string;
  qName: string; // QIC (Q In Charge)
  createdAt: string;
  fitnessGoal: FitnessGoal;
  equipment: EquipmentType[];
  workoutStyle: WorkoutStyle;
  terrain: TerrainLocation;
  weatherNote?: string;
  totalDurationMinutes: 45;
  disclaimer: string;
  sections: {
    warmup: WorkoutSection;
    theThang: WorkoutSection;
    mary: WorkoutSection;
    cot: WorkoutSection;
  };
  backblastTemplate?: string;
  qNotes?: string[];
  isAiGenerated: boolean;
}

export interface ExiconEntry {
  name: string;
  aka?: string;
  category:
    | "Warm-up"
    | "Upper Body"
    | "Lower Body"
    | "Core / Mary"
    | "Cardio / Agility"
    | "Coupon / Cindy";
  defaultCadence: "IC" | "OYO" | "Timed";
  description: string;
  coachingTip: string;
  equipment?: string;
}

export interface LexiconTerm {
  term: string;
  definition: string;
  usage: string;
}
