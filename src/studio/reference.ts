import { ExiconEntry, LexiconTerm, WorkoutStyle, FitnessGoal } from "./types";

export const F3_DISCLAIMER =
  "I am not a professional. You are here at your own risk. Modify exercises as necessary. Push yourself, but do not hurt yourself. The goal is to leave no man behind and no man where we found him.";

export const F3_FIVE_CORE_PRINCIPLES = [
  "1. Free of charge (Never costs a dime)",
  "2. Open to all men (Regardless of background or fitness level)",
  "3. Held outdoors, rain or shine, heat or cold (In the Gloom)",
  "4. Led by men who participate in a rotating fashion, with no training or certification",
  "5. Ends with a Circle of Trust (COT)",
];

export const EXICON_DATABASE: ExiconEntry[] = [
  // Warm-up (COP)
  {
    name: "Side Straddle Hop (SSH)",
    aka: "Jumping Jacks",
    category: "Warm-up",
    defaultCadence: "IC",
    description:
      "A common F3 warm-up starter. Traditional jumping jack performed in 4-count cadence.",
    coachingTip:
      "Establish the cadence early: 'In Cadence, Exercise! 1-2-3-ONE, 1-2-3-TWO...'",
  },
  {
    name: "Imperial Walker",
    aka: "Toy Soldier with Knee Drive",
    category: "Warm-up",
    defaultCadence: "IC",
    description:
      "Hands behind head, bring opposite knee up to touch opposite elbow with high torso rotation.",
    coachingTip: "Keep chest tall, don't crane neck forward.",
  },
  {
    name: "Hillbilly",
    aka: "Hillbilly Walker",
    category: "Warm-up",
    defaultCadence: "IC",
    description:
      "Hands behind head, bring same knee to same elbow laterally to engage obliques.",
    coachingTip: "Crunch the sides hard on every rep.",
  },
  {
    name: "Daisy Picker",
    aka: "Cherry Picker / Weed Picker",
    category: "Warm-up",
    defaultCadence: "IC",
    description:
      "Feet wide apart, hinge at hips: touch ground forward (1), center (2), back between feet (3), stand and recover (4).",
    coachingTip: "Keep legs straight to open up hamstrings.",
  },
  {
    name: "Michael Phelps",
    aka: "Arm Cross Hugs",
    category: "Warm-up",
    defaultCadence: "OYO",
    description:
      "Vigorously swinging arms wide open and then hugging torso across chest, alternating top arm.",
    coachingTip: "Great for shoulder and chest mobility before heavy Merkins.",
  },
  {
    name: "Good Morning",
    category: "Warm-up",
    defaultCadence: "IC",
    description:
      "Hands clasped behind head, slight bend in knees, hinge torso forward 90 degrees with flat back.",
    coachingTip: "Slow cadence to prime the lower back and posterior chain.",
  },
  {
    name: "Windmill",
    category: "Warm-up",
    defaultCadence: "IC",
    description:
      "Wide stance, arms extended in T-shape. Reach right hand to left foot, then left hand to right foot.",
    coachingTip:
      "Watch the hand reaching for the sky to increase thoracic rotation.",
  },

  // Upper Body
  {
    name: "Merkin",
    aka: "Standard Push-up",
    category: "Upper Body",
    defaultCadence: "IC",
    description:
      "Traditional chest-to-deck push-up. Strict form: plank straight, elbows at 45 degrees, full lockout.",
    coachingTip: "Modify on knees or hands-elevated if needed.",
  },
  {
    name: "Carolina Dry Dock (CDD)",
    aka: "Pike Push-up",
    category: "Upper Body",
    defaultCadence: "IC",
    description:
      "Hips high in downward dog position. Lower crown of head toward the ground between hands and press up.",
    coachingTip: "Targets front deltoids and triceps.",
  },
  {
    name: "Diamond Merkin",
    category: "Upper Body",
    defaultCadence: "IC",
    description:
      "Hands touching together forming a diamond under chest. Deep tricep and inner chest activator.",
    coachingTip: "Slow eccentric descent makes these burn even faster.",
  },
  {
    name: "Ranger Merkin",
    category: "Upper Body",
    defaultCadence: "IC",
    description:
      "Thumbs in line with armpits, elbows pinned tightly against ribs throughout movement.",
    coachingTip: "Maximum triceps recruitment.",
  },
  {
    name: "Werkin",
    aka: "Wide Grip Merkin",
    category: "Upper Body",
    defaultCadence: "IC",
    description: "Hands placed well wider than shoulder width.",
    coachingTip: "Directly targets outer chest fibers.",
  },
  {
    name: "Peter Parker",
    category: "Upper Body",
    defaultCadence: "IC",
    description:
      "In plank, drive right knee forward to touch right elbow as you perform a pushup, alternate sides.",
    coachingTip: "Spider-man pushup style: core and chest combo.",
  },
  {
    name: "Dips",
    aka: "Bench or Bleacher Dips",
    category: "Upper Body",
    defaultCadence: "IC",
    description:
      "Back to bench or curb, hands gripping edge, lower hips down until elbows reach 90 degrees, press up.",
    coachingTip: "Straight legs increase difficulty; bent knees modify.",
  },
  {
    name: "Derkin",
    aka: "Decline Merkin",
    category: "Upper Body",
    defaultCadence: "IC",
    description:
      "Feet elevated on curb, bench, or bleacher; hands on ground. Push up from decline.",
    coachingTip: "Shifts load heavily to upper chest and anterior shoulders.",
  },
  {
    name: "Erkin",
    aka: "Incline Merkin",
    category: "Upper Body",
    defaultCadence: "IC",
    description:
      "Hands elevated on curb or bench, feet on ground. Push up at an incline.",
    coachingTip: "Great high-volume burnout after Derkins.",
  },

  // Lower Body
  {
    name: "Bobby Hurley",
    category: "Lower Body",
    defaultCadence: "OYO",
    description:
      "Quick squat, touch floor with both hands, jump up clapping hands overhead in basketball shooting motion.",
    coachingTip: "Named after Duke guard Bobby Hurley. Fast explosive cadence.",
  },
  {
    name: "Monkey Humper",
    category: "Lower Body",
    defaultCadence: "IC",
    description:
      "Feet wide, squat down grasping shins or ankles. Keeping hands on ankles, raise and lower hips repeatedly.",
    coachingTip:
      "The ultimate F3 crowd pleaser and quad burner. Good eye contact forbidden.",
  },
  {
    name: "Al Gore",
    category: "Lower Body",
    defaultCadence: "Timed",
    description:
      "Static wall sit without a wall. Half-squat hold, arms extended forward, chest high.",
    coachingTip: "Hold for 45-60 seconds during mumblechatter announcements.",
  },
  {
    name: "Copperhead Squat",
    category: "Lower Body",
    defaultCadence: "IC",
    description:
      "Slow 4-count squat: 3 counts down, explosive 1 count to the top.",
    coachingTip:
      "Forces time-under-tension and prevents bouncing out of the hole.",
  },
  {
    name: "Smurf Jack",
    category: "Lower Body",
    defaultCadence: "IC",
    description:
      "Maintain a quarter-squat position while performing jumping jack foot action, never standing straight up.",
    coachingTip: "Burns out the glutes and quads rapidly.",
  },
  {
    name: "Lunges",
    category: "Lower Body",
    defaultCadence: "IC",
    description:
      "Step forward, drop rear knee to hover 1 inch above turf, drive through front heel.",
    coachingTip: "Walking lunges across field or stationary in cadence.",
  },

  // Core / Mary
  {
    name: "American Hammer",
    aka: "Russian Twist",
    category: "Core / Mary",
    defaultCadence: "IC",
    description:
      "Balance on sit bones with heels elevated 6 inches. Clasp hands and rotate side to side touching ground.",
    coachingTip:
      "The undisputed King of Mary. Typically called for 20+ IC reps.",
  },
  {
    name: "Flutter Kick",
    category: "Core / Mary",
    defaultCadence: "IC",
    description:
      "On back, hands under tailbone, legs straight, flutter heels alternately 6 to 18 inches off the ground.",
    coachingTip: "Keep toes pointed, lower back glued to the turf.",
  },
  {
    name: "Rosalita",
    category: "Core / Mary",
    defaultCadence: "IC",
    description:
      "On back, legs straight up at 90 degrees or 45 degrees, open legs wide, close, open, close in cadence.",
    coachingTip: "F3 classic named after the Bruce Springsteen song.",
  },
  {
    name: "LBC (Little Baby Crunch)",
    category: "Core / Mary",
    defaultCadence: "IC",
    description:
      "On back, knees bent 90 degrees in air, fingertips behind ears. Micro-crunch bringing ribs toward pelvis.",
    coachingTip: "Focus on continuous tension without pulling on the neck.",
  },
  {
    name: "Freddie Mercury",
    aka: "Bicycle Crunch",
    category: "Core / Mary",
    defaultCadence: "IC",
    description:
      "Supine bicycle kick: rotate elbow to opposite knee in 4-count rhythm singing 'Bicycle, bicycle!'",
    coachingTip: "Don't rush the tempo; slow and controlled wins.",
  },
  {
    name: "Hello Dolly",
    category: "Core / Mary",
    defaultCadence: "IC",
    description:
      "On back, heels 6 inches off ground. Open legs wide and close them horizontally while keeping heels hovering.",
    coachingTip: "Devastates lower abdominals and hip flexors.",
  },
  {
    name: "Big Boy Sit-up",
    aka: "Full Military Sit-up",
    category: "Core / Mary",
    defaultCadence: "OYO",
    description:
      "Full range sit-up: shoulder blades touch ground, sit all the way up to touch ankles, arms folded on chest.",
    coachingTip: "No anchoring feet under benches unless specified.",
  },
  {
    name: "Dying Cockroach",
    category: "Core / Mary",
    defaultCadence: "IC",
    description:
      "On back, arms and legs up in air like an upside-down dead bug. Flutter limbs simultaneously.",
    coachingTip: "Hilarious visual, serious burn.",
  },
  {
    name: "Plank-o-Rama",
    category: "Core / Mary",
    defaultCadence: "Timed",
    description:
      "Sequence of high plank, low forearm plank, right side star plank, left side star plank, chilcutt.",
    coachingTip: "Rotate every 30 seconds without letting knees touch.",
  },

  // Cardio / Agility
  {
    name: "Burpee",
    category: "Cardio / Agility",
    defaultCadence: "OYO",
    description:
      "Drop to deck, chest hits turf, pushup, jump feet to hands, leap vertically with clap overhead.",
    coachingTip: "The penalty and glory exercise of F3.",
  },
  {
    name: "Bear Crawl",
    category: "Cardio / Agility",
    defaultCadence: "OYO",
    description:
      "Hands and toes on ground, knees hovering 2 inches off deck. Crawl forward across the field.",
    coachingTip: "Keep hips low and back flat like a tabletop.",
  },
  {
    name: "Crawl Bear",
    category: "Cardio / Agility",
    defaultCadence: "OYO",
    description: "Bear crawl backwards. Massive quad and shoulder burner.",
    coachingTip: "Watch out for curbs and light poles behind you.",
  },
  {
    name: "Crab Walk",
    category: "Cardio / Agility",
    defaultCadence: "OYO",
    description:
      "Face up, hands behind, walk backwards or forwards supporting torso above ground.",
    coachingTip: "Opens tight chest while firing hamstrings and triceps.",
  },
  {
    name: "Suicide Sprints",
    category: "Cardio / Agility",
    defaultCadence: "OYO",
    description:
      "Sprint to cone 1 and touch, sprint back to base. Sprint to cone 2, back to base. Repeat to cone 3 & 4.",
    coachingTip: "Touch lines with hand to ensure full deceleration.",
  },

  // Coupon / Cindy (Cinder block)
  {
    name: "Blockee",
    category: "Coupon / Cindy",
    defaultCadence: "OYO",
    description:
      "Burpee with a Cindy: drop with hands on block, pushup, hop in, lift block into overhead thruster press.",
    coachingTip: "Maintain flat back when lifting Cindy off the ground.",
  },
  {
    name: "Curls for the Girls",
    aka: "Cindy Bicep Curls",
    category: "Coupon / Cindy",
    defaultCadence: "IC",
    description:
      "Stand tall holding Cindy by the outer web openings. Strict bicep curls.",
    coachingTip: "Elbows tucked against ribs, no body swinging.",
  },
  {
    name: "Overhead Press (OHP)",
    category: "Coupon / Cindy",
    defaultCadence: "IC",
    description:
      "Hold Cindy at collarbone, press directly overhead to full lockout without hyperextending lower back.",
    coachingTip: "Engage glutes and core to protect lumbar spine.",
  },
  {
    name: "Kettlebell Swing (Cindy Swing)",
    category: "Coupon / Cindy",
    defaultCadence: "IC",
    description:
      "Hold coupon between legs, explosive hip hinge driving block forward to eye level.",
    coachingTip: "Power comes from glute snap, not arm lifting.",
  },
  {
    name: "Chest Press with Cindy",
    category: "Coupon / Cindy",
    defaultCadence: "IC",
    description:
      "Lie flat on turf with Cindy resting on chest, press up in cadence like a bench press.",
    coachingTip: "Control the descent to avoid landing block on ribs.",
  },
  {
    name: "Farmer Carry",
    category: "Coupon / Cindy",
    defaultCadence: "OYO",
    description:
      "Carry one or two Cindys at sides walking briskly across parking lot or field.",
    coachingTip: "Stand straight, shoulders pinned back, do not lean.",
  },
];

export const F3_LEXICON: LexiconTerm[] = [
  {
    term: "Pax",
    definition: "The members / participants who show up to the workout.",
    usage: "'We had 18 Pax in the Gloom this morning.'",
  },
  {
    term: "Q / QIC",
    definition:
      "The leader of the workout. QIC = 'Q In Charge'. F3 is led in rotating fashion by any man willing to lead.",
    usage: "'Who has the Q tomorrow at The Forge?'",
  },
  {
    term: "Gloom",
    definition:
      "The early morning darkness before sunrise when F3 workouts take place (typically 5:30 AM).",
    usage: "'15 men posted in the Gloom despite 28-degree weather.'",
  },
  {
    term: "AO (Area of Operation)",
    definition:
      "The physical workout location (park, school campus, parking lot).",
    usage: "'Welcome to AO The Pit.'",
  },
  {
    term: "COP (Circle of Pain)",
    definition:
      "Also known as Warm-o-Rama. The opening warm-up circle where cadence exercises get the heart rate up.",
    usage: "'Circle up for the COP. Starting with 20 SSH in cadence.'",
  },
  {
    term: "The Thang",
    definition: "The main body of the beatdown (approx 25-30 minutes).",
    usage: "'Partner up for The Thang: Dora 1-2-3 with a Cindy.'",
  },
  {
    term: "Mary",
    definition:
      "The 5-8 minute abdominal and core workout circle right before COT.",
    usage: "'Time for 6MOM (Six Minutes of Mary). American Hammers to start.'",
  },
  {
    term: "COT (Circle of Trust)",
    definition:
      "The closing circle of the workout: Count-o-Rama, Name-o-Rama, announcements, and a short word/prayer.",
    usage: "'We close every beatdown in the COT. Circle up men.'",
  },
  {
    term: "Cindy / Coupon",
    definition:
      "A cinder block (concrete masonry unit) used as a heavy weight during workouts.",
    usage: "'Grab a Cindy from the block pile and meet at the flag.'",
  },
  {
    term: "FNG (Friendly New Guy)",
    definition:
      "A first-time attendee who will receive his permanent F3 nickname at the Name-o-Rama.",
    usage: "'We have two FNGs today, let's get their story in the COT.'",
  },
  {
    term: "Mumblechatter",
    definition:
      "Good-natured ribbing, complaining, and humor exchanged among the Pax during the workout.",
    usage: "'High-grade mumblechatter during those 50 burpees.'",
  },
  {
    term: "EH (Emotional Headlock)",
    definition:
      "The art of relentlessly inviting another man to come try F3 until he shows up.",
    usage:
      "'I put an EH on my neighbor for three weeks until he finally posted.'",
  },
  {
    term: "IC (In Cadence)",
    definition:
      "Exercises counted out loud by the Q in a 4-count rhythm (1-2-3-ONE, 1-2-3-TWO).",
    usage: "'Merkins in cadence. Starting on my lead.'",
  },
  {
    term: "OYO (On Your Own)",
    definition:
      "Exercises performed at each man's individual pace to a specified rep count.",
    usage: "'25 Big Boy Sit-ups OYO, recover when done.'",
  },
  {
    term: "Backblast",
    definition:
      "The written recap of the workout published on Slack, Band, or the local F3 website.",
    usage: "'I will post the Backblast by lunch with the Pax count.'",
  },
];

export const WORKOUT_STYLE_TEMPLATES: Record<
  WorkoutStyle,
  {
    title: string;
    tagline: string;
    description: string;
    howItWorks: string[];
    typicalDuration: number;
    recommendedGoals: FitnessGoal[];
  }
> = {
  "dora-123": {
    title: "Dora 1-2-3 (The Classic Partner Grind)",
    tagline: "Partner up. One works, one runs, tag and switch.",
    description:
      "Pairs work together to accumulate a cumulative rep goal (e.g. 100 Merkins, 200 Squats, 300 Big Boys). Partner A exercises while Partner B sprints to a landmark and back, then switch.",
    howItWorks: [
      "Find a partner of similar pace. Partner A starts grinding Exercise 1.",
      "Partner B sprints 50-75 yards to the turn cone/light pole and sprints back.",
      "Flapjack (switch roles) and continue accumulating total reps as a team.",
      "Progress to Exercise 2 once target reached, then Exercise 3.",
    ],
    typicalDuration: 26,
    recommendedGoals: ["full-body-grit", "cardio-endurance", "upper-body"],
  },
  "the-11s": {
    title: "The 11s (Ascending / Descending Ladder)",
    tagline: "10 & 1, 9 & 2... Reps always sum to 11.",
    description:
      "Two exercises stationed across a distance (e.g. 40-50 yard field). Start at Baseline with 1 rep of Exercise A, sprint across, perform 10 reps of Exercise B. Sprint back for 2 of A and 9 of B until complete.",
    howItWorks: [
      "Station 1 (Baseline): Exercise A (starts at 1 rep, counts UP to 10).",
      "Sprint across field to Station 2.",
      "Station 2 (Far line): Exercise B (starts at 10 reps, counts DOWN to 1).",
      "Total reps per round always equal 11. 10 rounds total; define each travel leg and return explicitly.",
    ],
    typicalDuration: 25,
    recommendedGoals: ["cardio-endurance", "high-intensity-hiit", "legs-hills"],
  },
  "four-corners": {
    title: "Four Corners (Perimeter Burner)",
    tagline: "Run the square, conquer each corner station.",
    description:
      "Use a football field, parking lot, or open park. Four stations marked with cones or light poles. Run the perimeter and hit escalating exercises at each corner.",
    howItWorks: [
      "Corner 1: 10 Merkins -> Sprint to Corner 2.",
      "Corner 2: 20 Squats -> Bear crawl or sprint to Corner 3.",
      "Corner 3: 30 LBCs -> Sprint to Corner 4.",
      "Corner 4: 40 Bobby Hurleys -> Sprint back to Corner 1.",
      "Round 2 introduces variation (e.g. coupon carry, backwards run).",
    ],
    typicalDuration: 27,
    recommendedGoals: ["cardio-endurance", "full-body-grit", "legs-hills"],
  },
  "route-66": {
    title: "Route 66 (Light Pole Ladder)",
    tagline:
      "11 stops. 1 rep at pole 1, 2 at pole 2, up to 11 at pole 11. Sum = 66.",
    description:
      "Run along a row of light poles, benches, or trees. Stop at each marker and perform ascending reps of a single exercise or alternating push/pull exercises.",
    howItWorks: [
      "Stop 1: 1 rep -> jog to Stop 2.",
      "Stop 2: 2 reps -> jog to Stop 3.",
      "Continue ascending until Stop 11 with 11 reps.",
      "Math check: 1+2+3+4+5+6+7+8+9+10+11 = 66 total reps.",
    ],
    typicalDuration: 24,
    recommendedGoals: ["legs-hills", "cardio-endurance", "upper-body"],
  },
  "iron-hulk": {
    title: "Iron Hulk (Push & Press Escalator)",
    tagline: "1 Merkin : 4 Air Presses up to 10 : 40.",
    description:
      "A brutal shoulder and chest escalator. 1 Merkin on the deck, immediately jump up for 4 overhead Air Presses. 2 Merkins / 8 Air Presses, ascending all the way to 10 Merkins and 40 Air Presses (55 Merkins, 220 Air Presses).",
    howItWorks: [
      "Stationary or paired with a 25-yard run between rounds.",
      "Ratio is 1 push-up to 4 overhead presses.",
      "Ascend from 1:4 to 10:40.",
      "Finish with a lung-burning lap around the AO.",
    ],
    typicalDuration: 25,
    recommendedGoals: ["upper-body", "high-intensity-hiit"],
  },
  "deck-of-death": {
    title: "Deck of Death (Card Cadence)",
    tagline:
      "Hearts = Merkins, Spades = Burpees, Diamonds = Squats, Clubs = Big Boys.",
    description:
      "A full deck of cards dictating the pain. Face value equals reps (Face cards = 10, Aces = 15, Jokers = 20 Burpees). The Q flips cards rapid-fire.",
    howItWorks: [
      "Q draws cards one by one from the deck.",
      "Pax immediately hit the card's exercise and reps.",
      "Every 5 cards, include an active recovery lap or 30-second Al Gore.",
    ],
    typicalDuration: 28,
    recommendedGoals: ["full-body-grit", "high-intensity-hiit"],
  },
  "circuit-grinder": {
    title: "The Grinder (Multi-Station EMOM / Circuit)",
    tagline: "Continuous functional stations with minimal rest.",
    description:
      "Pax split into 3 or 4 stations around the AO. Station 1 is the timer (e.g. lap sprint or 20 burpees). When timer finishes, yell 'Rotate!' and all stations advance.",
    howItWorks: [
      "Station 1: Timer station (e.g. 100m sprint + 5 burpees).",
      "Station 2: Coupon / Upper body grinder.",
      "Station 3: Bleacher step-ups or broad jumps.",
      "Station 4: Plank variations or core hold.",
      "Rotate on Station 1's call.",
    ],
    typicalDuration: 28,
    recommendedGoals: ["full-body-grit", "ruck-strength", "upper-body"],
  },
  "tabata-beatdown": {
    title: "Tabata Beatdown (20s Max Effort / 10s Rest)",
    tagline: "8 rounds per block. 4 minutes of absolute smoke.",
    description:
      "High-intensity intervals structured as 20 seconds of all-out effort followed by 10 seconds of rest. 4 to 5 distinct Tabata blocks covering full body.",
    howItWorks: [
      "Block 1: Merkins & Mountain Climbers (4 min).",
      "1 min active jog.",
      "Block 2: Jump Squats & High Knees (4 min).",
      "1 min active jog.",
      "Block 3: Coupon Curls & Overhead Thrusters (4 min).",
      "Block 4: Bear Crawls & Burpees (4 min).",
    ],
    typicalDuration: 26,
    recommendedGoals: ["high-intensity-hiit", "cardio-endurance"],
  },
  "iron-pax-challenge": {
    title: "Iron PAX Challenge",
    tagline: "Published Greenwood benchmarks; each workout has its own rules.",
    description:
      "Choose an exact published workout and year/week. A generic AMRAP is an IPC-inspired adaptation, not an official benchmark.",
    howItWorks: [
      "Use the original published exercises, counts, timing and standards for a benchmark.",
      "If adapting, label the plan IPC-inspired and explain the changes.",
    ],
    typicalDuration: 29,
    recommendedGoals: ["full-body-grit"],
  },
};
