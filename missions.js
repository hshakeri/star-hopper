// missions.js - Detailed 6-Step Pedagogical Mission configurations for Star Hopper

function buildScaffoldCode(scaffold, values = {}) {
  if (!scaffold || !scaffold.template) return "";

  let code = scaffold.template;
  (scaffold.slots || []).forEach(slot => {
    const value = Object.prototype.hasOwnProperty.call(values, slot.id) ? values[slot.id] : slot.value;
    const token = new RegExp(`\\{${slot.id}\\}`, "g");
    code = code.replace(token, String(value));
  });
  return code;
}

function getCorrectedScaffoldValues(scaffold) {
  const values = {};
  if (!scaffold || !Array.isArray(scaffold.slots)) return values;
  scaffold.slots.forEach(slot => {
    if (slot.correctValue !== undefined) values[slot.id] = slot.correctValue;
  });
  return values;
}

const PlatformerMissions = [
  {
    id: "earth-gravity-wall",
    planetId: 0, // Earth
    title: "Hopper Engineering Shakedown",
    ageRange: "8-12",
    concept: "Newton's 2nd law: acceleration = force ÷ mass. A lighter rover (or a stronger engine) reaches a higher top speed and jumps higher under the same push.",
    beginnerConcept: "Change one number, test, then change another — and notice that less mass makes the same engine go faster and jump higher.",
    codingConcept: "Variable assignment and parameter tuning",
    starterCode: "use_hopper()\ngravity = 4.9\nhopper.mass = 1.2\nhopper.engine = 6\nplayer.jump_power = 18",
    objective: "Push Hopper's Agility past 30 with any mix of lower mass, lower gravity, more engine force, and more jump force, to unlock every Emerald Core gem and clear the wall.",
    steps: [
      { id: "observe", prompt: "Observe: Hopper is too heavy to clear the high metal wall with default settings.", done: false },
      { id: "predict", prompt: "Predict: If you lower the mass but keep the same engine, will the top speed go up, down, or stay the same?", done: false },
      { id: "code", prompt: "Code: Lower hopper.mass and gravity, then raise hopper.engine and player.jump_power.", done: false },
      { id: "test", prompt: "Test: Swap to Hopper, collect the locked ridge gems, and watch how a lighter rover moves faster and jumps higher.", done: false },
      { id: "explain", prompt: "Explain: Why did lowering the mass raise both the speed and the jump?", done: false },
      { id: "challenge", prompt: "Challenge: Clear the wall as Hopper with gravity <= 5.7 m/s² and hopper.mass <= 1.2, reaching top speed >= 4.8 by tuning engine and mass.", done: false }
    ],
    hints: [
      "Mission Coach gives starter values; edit the numbers to reach the target.",
      "Hopper needs less mass and more horizontal speed than the default suit.",
      "Low Emerald gems unlock after gravity is tuned; high ridge gems need the full Hopper build."
    ],
    scaffold: {
      mode: "fill-values",
      template: "use_hopper()\ngravity = {gravity}\nhopper.mass = {mass}\nhopper.engine = {engine}\nplayer.jump_power = {jump_power}",
      slots: [
        { id: "gravity", label: "gravity (m/s²)", value: "4.9", hint: "Gravity in m/s² (Earth is 9.8). Less gravity lets Hopper hang longer and jump higher." },
        { id: "mass", label: "mass", value: "1.2", hint: "Less mass means the SAME engine and jump push Hopper faster and higher (a = F / m)." },
        { id: "engine", label: "engine", value: "6", hint: "Top speed = engine force ÷ mass. Raise the force or drop the mass to go faster." },
        { id: "jump_power", label: "jump", value: "18", hint: "Jump height = jump force ÷ mass. A lighter Hopper jumps higher for the same force." }
      ],
      explain: "Activate Hopper, then raise its Agility past 30. Agility climbs when you lower mass or gravity, or raise engine force or jump force — there's no single right answer, just get the number over 30 (watch it print in the shell).",
      parentPrompt: "When you lowered the mass, what happened to the speed and the jump?",
      codeIdea: "Activate Hopper, lower the mass, and raise the engine and jump force.",
      physicsIdea: "Newton's 2nd law: acceleration = force ÷ mass. Same engine + less mass = more speed and a higher jump.",
      success: "The lighter, stronger Hopper reaches top speed >= 4.8, clears the wall, and collects every Emerald Core gem."
    },
    prediction: {
      question: "Which change will help Hopper reach the high Emerald gems?",
      options: [
        { id: "lighter-longer", label: "Lower gravity and lighter Hopper", feedback: "Good prediction. Less pull and less mass make the jump arc easier to stretch.", correct: true },
        { id: "heavier", label: "Make Hopper heavier", feedback: "A heavier Hopper is harder to lift, so the arc usually gets shorter." },
        { id: "music", label: "Change the music", feedback: "Music changes the mood, but the physics numbers change the jump." }
      ]
    },
    resultChecks: [
      {
        id: "earth-hopper-active",
        label: "Hopper activated",
        success: "Hopper is active, so the engineering numbers apply to the heavy suit.",
        waiting: "Run the coach code to activate Hopper.",
        check: (game) => game.player && game.player.charType === 'hopper'
      },
      {
        id: "earth-emerald-gates",
        label: "Agility 30+ reached",
        success: "Agility cleared 30 — every Emerald gem is unlocked. Any mix of mass, gravity, engine, and jump that gets there works.",
        waiting: "Agility is still under 30. Lower mass/gravity or raise engine/jump — the shell prints your current Agility after each line.",
        check: (game) => typeof game.getLockedRequiredCollectibleCount === 'function' && game.getLockedRequiredCollectibleCount() === 0
      }
    ],
    badge: {
      id: "variables",
      icon: "🔧",
      label: "Variable Tuner",
      description: "Changed named numbers to engineer a better jump."
    },
    validate: (game) => game.isEarthHopperEngineered() && game.player.x > 1100,
    reflection: [
      "Which parameter changed the arc the most?",
      "Did Hopper need more force or less mass?",
      "Where was the velocity vector largest?"
    ]
  },
  {
    id: "moon-canyon-jump",
    planetId: 1, // Moon
    title: "Luna Loop Springs",
    ageRange: "8-12",
    concept: "Spring elastic force stores kinetic energy to launch objects.",
    beginnerConcept: "Loops repeat a command so you do not type the same thing again and again.",
    codingConcept: "Repeat loops",
    starterCode: "repeat 3: spawn_spring()",
    objective: "Use arithmetic jump tuning and repeat loops to collect Moon Quartz gems and cross the lunar canyon.",
    steps: [
      { id: "observe", prompt: "Observe: Walking off the edge makes you fall into the canyon.", done: false },
      { id: "predict", prompt: "Predict: Can 3 springs carry you all the way across?", done: false },
      { id: "code", prompt: "Code: Type: repeat 3: spawn_spring()", done: false },
      { id: "test", prompt: "Test: Run over the springs to trigger the elastic bounce and reach the high Quartz gems.", done: false },
      { id: "explain", prompt: "Explain: How does a spring conserve and return energy?", done: false },
      { id: "challenge", prompt: "Challenge: Spawn 5 springs in a row and reach the top platform.", done: false }
    ],
    hints: [
      "Loops allow you to run the same command multiple times.",
      "Springs launch you upwards when you step on them.",
      "Lower Quartz gems use jump arithmetic; high Quartz gems unlock after the spring loop."
    ],
    scaffold: {
      mode: "pattern-fill",
      template: "player.jump_power = gravity * {jump_math}\nrepeat {springs}: spawn_spring()",
      slots: [
        { id: "jump_math", label: "gravity x", value: "10", hint: "Moon gravity (~2 m/s²) times 10 makes a jump force tall enough." },
        { id: "springs", label: "springs", value: "3", hint: "The loop places three spring launchpads." }
      ],
      explain: "Arithmetic makes the jump power, and the repeat loop builds several springs from one line.",
      parentPrompt: "Why is a loop easier than typing spawn_spring three times?",
      codeIdea: "Use one math line and one repeat loop.",
      physicsIdea: "Springs store energy and return it as a bounce.",
      success: "Rover collects Moon Quartz gems after using arithmetic and springs."
    },
    prediction: {
      question: "What will repeat 3 do to the spring command?",
      options: [
        { id: "three-springs", label: "Build 3 springs", feedback: "Yes. A repeat loop runs the spring command three times.", correct: true },
        { id: "one-big", label: "Build 1 giant spring", feedback: "Repeat does not resize the spring; it runs the same command again." },
        { id: "no-change", label: "Do nothing", feedback: "The loop runs code, so the level should change." }
      ]
    },
    resultChecks: [
      {
        id: "moon-jump-math",
        label: "Jump math worked",
        success: "Jump power now comes from arithmetic, so Moon hops reach higher.",
        waiting: "Jump power still needs the gravity math line.",
        check: (game) => game.player && game.player.jumpPower >= 18
      },
      {
        id: "moon-spring-loop",
        label: "Spring loop built",
        success: "The repeat loop placed enough springs to chain bounces.",
        waiting: "Run the repeat loop until 3 springs are placed.",
        check: (game) => game.spawnedSprings && game.spawnedSprings.length >= 3
      }
    ],
    badge: {
      id: "loops",
      icon: "🔁",
      label: "Loop Builder",
      description: "Used one repeat command to build several tools."
    },
    validate: (game, Compiler) => {
      return game.spawnedSprings.length >= 3 && game.player.x > 1200;
    },
    reflection: [
      "How did placing multiple springs affect your speed?",
      "Did the low lunar gravity help you stay in the air?",
      "Where was the potential energy highest?"
    ]
  },
  {
    id: "jupiter-rocket-heavy",
    planetId: 2, // Jupiter
    title: "Escape Velocity",
    ageRange: "8-12",
    concept: "Mass resists acceleration: heavy objects require more force.",
    beginnerConcept: "Force, mass, and speed work together. Heavy things need a stronger push.",
    codingConcept: "Multi-parameter Hopper engineering",
    starterCode: "use_hopper()\nhopper.mass = 1.2\nhopper.rocket_power = 75\nhopper.engine = 6",
    objective: "Push Hopper's Thrust past 45 (more rocket power or engine, less mass) to unlock the Amber Storm gems, then escape the gravity trench — spawn crate blocks with a loop if you need stepping stones across the gaps.",
    steps: [
      { id: "observe", prompt: "Observe: Swap to Hopper: notice he is heavy and jumps poorly.", done: false },
      { id: "predict", prompt: "Predict: Will Hopper need more rocket force on Jupiter than Earth?", done: false },
      { id: "code", prompt: "Code: Engineer Hopper with lower mass and stronger rocket_power and hopper.engine (top speed = engine ÷ mass).", done: false },
      { id: "test", prompt: "Test: Trigger your jump, hold Space to rocket boost, and collect the Amber Storm gems.", done: false },
      { id: "explain", prompt: "Explain: Why does more mass need more force to reach the same speed?", done: false },
      { id: "challenge", prompt: "Challenge: Escape with default Jupiter gravity using hopper.rocket_power >= 70 and hopper.mass <= 1.4, reaching top speed >= 4.5 (engine ÷ mass).", done: false }
    ],
    hints: [
      "Jupiter's gravity is extremely strong (g ≈ 24.5 m/s², about 2.5x Earth).",
      "Hopper has rocket boosters activated by holding Space in mid-air.",
      "Amber Storm gems unlock after the Hopper build and crate-loop lesson are both active."
    ],
    scaffold: {
      mode: "choose-tune",
      template: "use_hopper()\nhopper.mass = {mass}\nhopper.rocket_power = {rocket_power}\nhopper.engine = {engine}\nrepeat {boxes}: spawn_box()",
      commandChoices: ["use_hopper()", "hopper.mass", "hopper.rocket_power", "hopper.engine", "repeat"],
      slots: [
        { id: "mass", label: "mass", value: "1.2", hint: "Lower mass helps Hopper accelerate (a = F / m)." },
        { id: "rocket_power", label: "rocket", value: "75", hint: "More rocket force fights Jupiter gravity." },
        { id: "engine", label: "engine", value: "6", hint: "Top speed = engine force ÷ mass. Raise force or drop mass to go faster." },
        { id: "boxes", label: "boxes", value: "3", hint: "Three boxes make a small building loop." }
      ],
      explain: "Activate Hopper, then raise its Thrust past 45: more rocket power and engine force, and less mass, all push it up. The shell prints your Thrust after each line. A loop builds helpful blocks.",
      parentPrompt: "Why does a heavier Hopper need more force to reach the same speed?",
      codeIdea: "Activate and tune Hopper (mass, rocket, engine), then repeat a box command.",
      physicsIdea: "More force and less mass create more acceleration (a = F / m).",
      success: "Hopper uses rocket force and boxes to collect Amber Storm gems."
    },
    prediction: {
      question: "On Jupiter, which engineering choice gives Hopper more acceleration?",
      options: [
        { id: "force-mass", label: "More rocket force and less mass", feedback: "Right. More force and less mass make acceleration stronger.", correct: true },
        { id: "less-force", label: "Less rocket force", feedback: "Less force makes it harder to fight Jupiter's gravity." },
        { id: "more-mass", label: "More mass", feedback: "More mass resists acceleration, so Hopper feels heavier." }
      ]
    },
    resultChecks: [
      {
        id: "jupiter-hopper-engineered",
        label: "Hopper engineered",
        success: "Hopper has enough rocket force, lower mass, and speed for Jupiter.",
        waiting: "Tune mass, rocket power, and speed together.",
        check: (game) => typeof game.isJupiterHopperEngineered === 'function' && game.isJupiterHopperEngineered()
      },
      {
        id: "jupiter-box-loop",
        label: "Crate loop built",
        success: "The loop placed crate blocks for the route.",
        waiting: "Run the repeat loop to place 3 crates.",
        check: (game) => game.spawnedBoxes && game.spawnedBoxes.length >= 3
      }
    ],
    badge: {
      id: "force-mass",
      icon: "🚀",
      label: "Force Engineer",
      description: "Balanced force and mass to move in heavy gravity."
    },
    validate: (game) => game.isJupiterHopperEngineered(),
    reflection: [
      "How did Hopper feel compared to Rover under Jupiter's gravity?",
      "What happens to acceleration when force increases but mass stays constant?",
      "Why did the rocket thrusters deplete your fuel bar?"
    ]
  },
  {
    id: "glacies-friction-loop",
    planetId: 3, // Glacies
    title: "Frictionless Slides",
    ageRange: "8-12",
    concept: "Friction is a resistive force that slows sliding motion.",
    beginnerConcept: "Friction is grip. Conditionals let code react when Rover touches something.",
    codingConcept: "Friction tuning and conditionals",
    starterCode: "friction = 8",
    objective: "Tune friction or spikes, then use an ice-touch rule to collect Violet Ice gems and climb the slopes.",
    steps: [
      { id: "observe", prompt: "Observe: Rover slides backwards down the slopes due to zero friction.", done: false },
      { id: "predict", prompt: "Predict: What will happen to sliding if friction is 8?", done: false },
      { id: "code", prompt: "Code: Type: friction = 8", done: false },
      { id: "test", prompt: "Test: Walk up the slopes without sliding back.", done: false },
      { id: "explain", prompt: "Explain: How does friction oppose the direction of relative movement?", done: false },
      { id: "challenge", prompt: "Challenge: Unlock the high Violet Ice gems by writing: when player.touching('ice'): jump_power = 20", done: false }
    ],
    hints: [
      "Low friction makes it hard to stop or climb.",
      "Hopper can deploy spikes by holding Down Arrow on the ground.",
      "Low Violet gems need friction or spikes; high Violet gems add an ice-touch rule."
    ],
    scaffold: {
      mode: "debug-fix",
      template: "friction = {friction}\nwhen player.touching('ice'): player.say('{message}')",
      slots: [
        { id: "friction", label: "friction", value: "slippery", correctValue: "8", hint: "This blank starts broken. Replace it with a number like 8." },
        { id: "message", label: "say", value: "slippery!", hint: "The event runs when Rover touches ice." }
      ],
      explain: "Friction gives grip, and the when rule lets the program notice ice.",
      parentPrompt: "What changed when friction got bigger?",
      codeIdea: "Set grip, then add a when-touching-ice rule.",
      physicsIdea: "Friction pushes against sliding motion.",
      success: "Rover controls the slide and collects Violet Ice gems."
    },
    prediction: {
      question: "What happens if friction becomes bigger on ice?",
      options: [
        { id: "more-grip", label: "Rover gets more grip", feedback: "Yes. Higher friction resists sliding and helps Rover stop.", correct: true },
        { id: "more-slide", label: "Rover slides forever", feedback: "That happens with low friction, not high friction." },
        { id: "more-gravity", label: "Gravity turns off", feedback: "Friction changes sliding, not the downward pull." }
      ]
    },
    resultChecks: [
      {
        id: "glacies-friction-fixed",
        label: "Friction debug fixed",
        success: "The friction value is a number now, so Rover has grip.",
        waiting: "Fix the broken friction blank with a number like 8.",
        check: (game) => typeof game.getCurrentFriction === 'function' && game.getCurrentFriction() >= 5
      },
      {
        id: "glacies-ice-event",
        label: "Ice event ready",
        success: "The when rule is ready to react when Rover touches ice.",
        waiting: "Keep the when player.touching('ice') rule in the code.",
        check: (game) => typeof game.hasIceTouchRule === 'function' && game.hasIceTouchRule()
      }
    ],
    badge: {
      id: "friction",
      icon: "🛞",
      label: "Friction Fixer",
      description: "Debugged grip so sliding motion could be controlled."
    },
    validate: (game, Compiler) => {
      const currentF = Compiler.env.friction !== null ? Compiler.env.friction : 0.02;
      return (currentF >= 5.0 || game.player.spikes) && game.player.x > 1000;
    },
    reflection: [
      "Why does ice have less friction than standard dirt?",
      "Did you slide further when moving fast?",
      "Did kinetic energy decrease faster with high friction?"
    ]
  },
  {
    id: "magnet-field-event",
    planetId: 4, // Mag-Net
    title: "Magnetic Force Fields",
    ageRange: "8-12",
    concept: "Magnetic poles attract or repel based on polarity.",
    beginnerConcept: "Events let code wait for a moment, then react automatically.",
    codingConcept: "Event hooks (When)",
    starterCode: "use_hopper()\nwhen hopper.rocket_on: gravity = 1.6\nwhen player.touching('magnet'): hopper.pole = 'south'",
    objective: "Combine rocket and touching event rules to collect Magenta Flux gems and cross the magnetic field gap.",
    steps: [
      { id: "observe", prompt: "Observe: Falling into the electric field instantly resets you.", done: false },
      { id: "predict", prompt: "Predict: Can electromagnet poles counteract gravity?", done: false },
      { id: "code", prompt: "Code: Write one rocket event and one magnet-touch event.", done: false },
      { id: "test", prompt: "Test: Hold Down/S in mid-air to engage magnets, float, and collect Magenta Flux gems.", done: false },
      { id: "explain", prompt: "Explain: How do magnetic fields apply force at a distance?", done: false },
      { id: "challenge", prompt: "Challenge: Clear the level by launching a crate box onto the goal trigger.", done: false }
    ],
    hints: [
      "Magnetic blocks pull Hopper if his electromagnet is on.",
      "Event rules (`when`) trigger actions automatically when a condition is met.",
      "Magenta Flux gems unlock only after both event-rule ideas are in the program."
    ],
    scaffold: {
      mode: "assemble-events",
      template: "use_hopper()\nwhen hopper.rocket_on: gravity = {gravity}\nwhen player.touching('magnet'): hopper.pole = '{pole}'",
      slots: [
        { id: "gravity", label: "gravity (m/s²)", value: "1.6", hint: "Gravity in m/s² (Earth is 9.8). Low gravity helps Hopper float while the rocket is on." },
        { id: "pole", label: "pole", value: "south", hint: "Changing pole changes how magnets push or pull." }
      ],
      explain: "Activate Hopper first; the event rules wait for rocket or magnet moments, then change physics.",
      parentPrompt: "What event made the code run by itself?",
      codeIdea: "Write two when rules that react to rocket and magnet moments.",
      physicsIdea: "Magnetic force can pull or push without touching.",
      success: "Hopper uses event rules to collect Magenta Flux gems."
    },
    prediction: {
      question: "What makes a when rule different from a normal line of code?",
      options: [
        { id: "waits", label: "It waits for an event", feedback: "Correct. A when rule waits, then reacts at the right moment.", correct: true },
        { id: "runs-once", label: "It only changes color", feedback: "A when rule can change physics, not just colors." },
        { id: "breaks-code", label: "It breaks the program", feedback: "A valid when rule is safe; it listens for an event." }
      ]
    },
    resultChecks: [
      {
        id: "magnet-rocket-event",
        label: "Rocket event assembled",
        success: "The rocket event can change gravity during boost moments.",
        waiting: "Add a when hopper.rocket_on rule.",
        check: (game) => typeof game.hasRocketEventRule === 'function' && game.hasRocketEventRule()
      },
      {
        id: "magnet-touch-event",
        label: "Magnet event assembled",
        success: "The magnet-touch event can switch Hopper's pole.",
        waiting: "Add a when player.touching('magnet') rule.",
        check: (game) => typeof game.hasPlayerTouchingRule === 'function' && game.hasPlayerTouchingRule()
      }
    ],
    badge: {
      id: "events",
      icon: "🧲",
      label: "Event Listener",
      description: "Built rules that wait for rocket and magnet moments."
    },
    validate: (game, Compiler) => {
      const hasRocketRule = typeof game.hasRocketEventRule === 'function'
        ? game.hasRocketEventRule()
        : Compiler.activeRules.some(r => r.target.includes('hopper.rocket_on'));
      const hasTouchRule = typeof game.hasPlayerTouchingRule === 'function'
        ? game.hasPlayerTouchingRule()
        : Compiler.activeRules.some(r => r.target.includes('player.touching'));
      return hasRocketRule && hasTouchRule && game.player.x > 1200;
    },
    reflection: [
      "What did the force vectors show when you activated the magnet?",
      "How does distance affect the strength of magnetic attraction?",
      "Where did the total energy of the system go?"
    ]
  }
];

const NavigatorMissions = [
  {
    id: "nav-orbit-school",
    title: "Orbit School",
    concept: "Circular Orbit",
    objective: "Maintain a stable circular orbit around the central Earth planet.",
    starterCode: "point_at('earth')\nthrust(power=3.5, seconds=1.5)",
    hints: [
      "An orbit is just falling towards a body but moving sideways fast enough to miss it!",
      "Find the balance where gravity pull matches centrifugal force.",
      "Use point_at('earth') and fire engines perpendicular to gravity."
    ],
    validate: (ship) => {
      // Circular orbits have stable distance and speed
      const r = Math.sqrt(ship.x*ship.x + ship.y*ship.y);
      const speed = Math.sqrt(ship.vx*ship.vx + ship.vy*ship.vy);
      return r > 150 && r < 300 && speed > 2.0 && speed < 4.0;
    }
  },
  {
    id: "nav-escape",
    title: "Escape Velocity",
    concept: "Escape Velocity",
    objective: "Gain enough speed to escape Earth's gravitational pull entirely.",
    starterCode: "thrust(power=8, seconds=4)",
    hints: [
      "Escape velocity is the speed where kinetic energy equals potential energy in a gravity field.",
      "Make a continuous burn away from Earth until the trajectory line opens up."
    ],
    validate: (ship) => {
      const r = Math.sqrt(ship.x*ship.x + ship.y*ship.y);
      const speed = Math.sqrt(ship.vx*ship.vx + ship.vy*ship.vy);
      return r > 400 && speed > 5.0; // Left orbit
    }
  },
  {
    id: "nav-slingshot",
    title: "Gravity Slingshot",
    concept: "Gravity Assist",
    objective: "Fly close to Jupiter and use its mass to slingshot you to hyper-speed.",
    starterCode: "point_at('jupiter')\nthrust(power=2, seconds=1)\nwait(5)",
    hints: [
      "A gravity assist steals orbital momentum from a massive planet to accelerate your spacecraft.",
      "Aim slightly behind the planet's path to maximize the velocity gain."
    ],
    validate: (ship) => {
      return ship.maxVelocityObserved > 12.0 && ship.closestApproachJupiter < 80;
    }
  },
  {
    id: "nav-time-dilation",
    title: "Einstein Time Dilation",
    concept: "Relativistic Clocks",
    objective: "Fly near light speed to make the spaceship clock tick 3x slower than Earth's clock.",
    starterCode: "thrust(power=12, seconds=8)",
    hints: [
      "Special Relativity tells us that time slows down for objects moving near the speed of light.",
      "Watch the relativistic time-gauge: accelerate your ship as much as possible!"
    ],
    validate: (ship) => {
      return ship.timeDilationFactor >= 3.0;
    }
  }
];
