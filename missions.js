// missions.js - Detailed 6-Step Pedagogical Mission configurations for Star Hopper

const PlatformerMissions = [
  {
    id: "earth-gravity-wall",
    planetId: 0, // Earth
    title: "The Gravity Dial",
    ageRange: "8-12",
    concept: "Gravity determines the downward pull on all objects.",
    codingConcept: "Variable assignment",
    starterCode: "gravity = 0.2\njump_power = 22",
    objective: "Clear the giant vertical wall in Base Camp.",
    steps: [
      { id: "observe", prompt: "Observe: Jump normal: you cannot clear the high metal wall.", done: false },
      { id: "predict", prompt: "Predict: If we set gravity = 0.2, will Star fall faster or slower?", done: false },
      { id: "code", prompt: "Code: Open the terminal and type: gravity = 0.2", done: false },
      { id: "test", prompt: "Test: Jump and watch the green trajectory path.", done: false },
      { id: "explain", prompt: "Explain: Why did lowering gravity let you jump higher?", done: false },
      { id: "challenge", prompt: "Challenge: Clear the wall with gravity = 0.3 and jump_power = 15.", done: false }
    ],
    hints: [
      "Smaller gravity means slower falling.",
      "Try changing one number at a time.",
      "Watch the velocity vector after each jump."
    ],
    validate: (game, Compiler) => {
      const currentG = Compiler.env.gravity !== null ? Compiler.env.gravity : 0.6;
      return currentG <= 0.25 && game.player.x > 1100;
    },
    reflection: [
      "What changed when gravity got smaller?",
      "Did you need more or less jump power?",
      "Where was the velocity vector largest?"
    ]
  },
  {
    id: "moon-canyon-jump",
    planetId: 1, // Moon
    title: "Luna Loop Springs",
    ageRange: "8-12",
    concept: "Spring elastic force stores kinetic energy to launch objects.",
    codingConcept: "Repeat loops",
    starterCode: "repeat 3: spawn_spring()",
    objective: "Use loops to place 3 springs and cross the lunar canyon.",
    steps: [
      { id: "observe", prompt: "Observe: Walking off the edge makes you fall into the canyon.", done: false },
      { id: "predict", prompt: "Predict: Can 3 springs carry you all the way across?", done: false },
      { id: "code", prompt: "Code: Type: repeat 3: spawn_spring()", done: false },
      { id: "test", prompt: "Test: Run over the springs to trigger the elastic bounce.", done: false },
      { id: "explain", prompt: "Explain: How does a spring conserve and return energy?", done: false },
      { id: "challenge", prompt: "Challenge: Spawn 5 springs in a row and reach the top platform.", done: false }
    ],
    hints: [
      "Loops allow you to run the same command multiple times.",
      "Springs launch you upwards when you step on them.",
      "Make sure you run the loop code before trying to jump the canyon."
    ],
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
    codingConcept: "Conditionals (If Statements)",
    starterCode: "if gravity > 1:\n    jump_power = 25",
    objective: "Escape the gravity trench as the heavy character Hopper.",
    steps: [
      { id: "observe", prompt: "Observe: Swap to Hopper: notice he is heavy and jumps poorly.", done: false },
      { id: "predict", prompt: "Predict: Will Hopper need more rocket force on Jupiter than Earth?", done: false },
      { id: "code", prompt: "Code: Type: if gravity > 1:\n    jump_power = 25", done: false },
      { id: "test", prompt: "Test: Trigger your jump and hold Space to rocket boost.", done: false },
      { id: "explain", prompt: "Explain: Why does mass require larger forces to accelerate?", done: false },
      { id: "challenge", prompt: "Challenge: Escape with gravity set to 2.5 using rocket boots.", done: false }
    ],
    hints: [
      "Jupiter's gravity is extremely strong (g = 2.0).",
      "Hopper has rocket boosters activated by holding Space in mid-air.",
      "Conditionals (if) allow rules to run only under specific situations."
    ],
    validate: (game, Compiler) => {
      return game.player.charType === 'hopper' && game.player.jumpPower >= 20 && game.player.y < 200 && game.player.x > 800;
    },
    reflection: [
      "How did Hopper feel compared to Star under Jupiter's gravity?",
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
    codingConcept: "Friction tuning and conditionals",
    starterCode: "friction = 8",
    objective: "Climb the ice slopes by tuning friction or using spikes.",
    steps: [
      { id: "observe", prompt: "Observe: Star slides backwards down the slopes due to zero friction.", done: false },
      { id: "predict", prompt: "Predict: What will happen to sliding if friction is 8?", done: false },
      { id: "code", prompt: "Code: Type: friction = 8", done: false },
      { id: "test", prompt: "Test: Walk up the slopes without sliding back.", done: false },
      { id: "explain", prompt: "Explain: How does friction oppose the direction of relative movement?", done: false },
      { id: "challenge", prompt: "Challenge: Reach the goal with friction = 0 by writing: when player.touching('ice'): jump_power = 20", done: false }
    ],
    hints: [
      "Low friction makes it hard to stop or climb.",
      "Hopper can deploy spikes by holding Down Arrow on the ground.",
      "You can override global friction variables directly from the console."
    ],
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
    codingConcept: "Event hooks (When)",
    starterCode: "when hopper.magnet_on:\n    gravity = 0.1",
    objective: "Activate the electromagnet and hover across the magnetic field gap.",
    steps: [
      { id: "observe", prompt: "Observe: Falling into the electric field instantly resets you.", done: false },
      { id: "predict", prompt: "Predict: Can electromagnet poles counteract gravity?", done: false },
      { id: "code", prompt: "Code: Type: when hopper.magnet_on:\n    gravity = 0.1", done: false },
      { id: "test", prompt: "Test: Hold Down/S in mid-air to engage magnets and float.", done: false },
      { id: "explain", prompt: "Explain: How do magnetic fields apply force at a distance?", done: false },
      { id: "challenge", prompt: "Challenge: Clear the level by launching a crate box onto the goal trigger.", done: false }
    ],
    hints: [
      "Magnetic blocks pull Hopper if his electromagnet is on.",
      "Event rules (`when`) trigger actions automatically when a condition is met.",
      "You can hover smoothly by holding S in mid-air while magnet_on is active."
    ],
    validate: (game, Compiler) => {
      return Compiler.activeRules.some(r => r.target.includes('magnet_on') || r.target.includes('player.touching')) && game.player.x > 1200;
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
