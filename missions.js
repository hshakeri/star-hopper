// missions.js - Detailed 6-Step Pedagogical Mission configurations for Star Hopper

const PlatformerMissions = [
  {
    id: "earth-gravity-wall",
    planetId: 0, // Earth
    title: "Hopper Engineering Shakedown",
    ageRange: "8-12",
    concept: "Gravity, mass, jump impulse, and run speed combine to shape a jump arc.",
    codingConcept: "Variable assignment and parameter tuning",
    starterCode: "gravity = 0.35\nplayer.jump_power = 17\nhopper.mass = 1.2\nplayer.speed = 4.8",
    objective: "Engineer Hopper with gravity, mass, jump power, and speed to unlock every Emerald Core gem and clear the wall.",
    steps: [
      { id: "observe", prompt: "Observe: Hopper is too heavy to clear the high metal wall with default settings.", done: false },
      { id: "predict", prompt: "Predict: Which change matters most: lower gravity, higher jump power, lower mass, or higher speed?", done: false },
      { id: "code", prompt: "Code: Tune at least three parameters, for example gravity, player.jump_power, hopper.mass, and player.speed.", done: false },
      { id: "test", prompt: "Test: Swap to Hopper, collect the locked ridge gems, and watch the green trajectory path.", done: false },
      { id: "explain", prompt: "Explain: Why did the tuned Hopper arc clear the wall?", done: false },
      { id: "challenge", prompt: "Challenge: Clear the wall as Hopper with gravity <= 0.35, player.jump_power >= 17, hopper.mass <= 1.2, and player.speed >= 4.8.", done: false }
    ],
    hints: [
      "The Code panel gives starter values; edit the numbers to reach the target.",
      "Hopper needs less mass and more horizontal speed than the default suit.",
      "Low Emerald gems unlock after gravity is tuned; high ridge gems need the full Hopper build."
    ],
    validate: (game, Compiler) => {
      const currentG = Compiler.env.gravity !== null ? Compiler.env.gravity : game.currentPlanet.physics.gravity;
      const currentSpeed = Compiler.env.speed !== null ? Compiler.env.speed : game.currentPlanet.physics.speed;
      const hopperMass = game.hopperMass !== undefined ? game.hopperMass : 2.5;
      return game.player.charType === 'hopper'
        && currentG <= 0.35
        && game.player.jumpPower >= 17
        && hopperMass <= 1.2
        && currentSpeed >= 4.8
        && game.player.x > 1100;
    },
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
    codingConcept: "Multi-parameter Hopper engineering",
    starterCode: "hopper.mass = 1.2\nhopper.rocket_power = 75\nplayer.speed = 5.0",
    objective: "Engineer Hopper and loop crate blocks to collect Amber Storm gems while escaping the gravity trench.",
    steps: [
      { id: "observe", prompt: "Observe: Swap to Hopper: notice he is heavy and jumps poorly.", done: false },
      { id: "predict", prompt: "Predict: Will Hopper need more rocket force on Jupiter than Earth?", done: false },
      { id: "code", prompt: "Code: Engineer Hopper with lower mass, stronger rocket_power, and higher player.speed.", done: false },
      { id: "test", prompt: "Test: Trigger your jump, hold Space to rocket boost, and collect the Amber Storm gems.", done: false },
      { id: "explain", prompt: "Explain: Why does mass require larger forces to accelerate?", done: false },
      { id: "challenge", prompt: "Challenge: Escape with default Jupiter gravity using hopper.rocket_power >= 70, hopper.mass <= 1.4, and player.speed >= 4.5.", done: false }
    ],
    hints: [
      "Jupiter's gravity is extremely strong (g = 2.0).",
      "Hopper has rocket boosters activated by holding Space in mid-air.",
      "Amber Storm gems unlock after the Hopper build and crate-loop lesson are both active."
    ],
    validate: (game, Compiler) => {
      const currentG = Compiler.env.gravity !== null ? Compiler.env.gravity : game.currentPlanet.physics.gravity;
      const currentSpeed = Compiler.env.speed !== null ? Compiler.env.speed : game.currentPlanet.physics.speed;
      const hopperMass = game.hopperMass !== undefined ? game.hopperMass : 2.5;
      return game.player.charType === 'hopper'
        && currentG >= game.currentPlanet.physics.gravity
        && currentSpeed >= 4.5
        && hopperMass <= 1.4
        && game.player.rocketPower >= 70
        && game.player.y < 220
        && game.player.x > 800;
    },
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
    objective: "Combine rocket and touching event rules to collect Magenta Flux gems and cross the magnetic field gap.",
    steps: [
      { id: "observe", prompt: "Observe: Falling into the electric field instantly resets you.", done: false },
      { id: "predict", prompt: "Predict: Can electromagnet poles counteract gravity?", done: false },
      { id: "code", prompt: "Code: Type: when hopper.magnet_on:\n    gravity = 0.1", done: false },
      { id: "test", prompt: "Test: Hold Down/S in mid-air to engage magnets, float, and collect Magenta Flux gems.", done: false },
      { id: "explain", prompt: "Explain: How do magnetic fields apply force at a distance?", done: false },
      { id: "challenge", prompt: "Challenge: Clear the level by launching a crate box onto the goal trigger.", done: false }
    ],
    hints: [
      "Magnetic blocks pull Hopper if his electromagnet is on.",
      "Event rules (`when`) trigger actions automatically when a condition is met.",
      "Magenta Flux gems unlock only after both event-rule ideas are in the program."
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
