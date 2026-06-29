// entities.js - Game objects: Player (Star & Hopper), Enemies, Interactive Items, and Particles

// Particle Class for visual effects
class Particle {
  constructor(x, y, color, size, vx, vy, maxLife, type = 'pixel') {
    this.x = x;
    this.y = y;
    this.color = color;
    this.size = size;
    this.vx = vx;
    this.vy = vy;
    this.alpha = 1;
    this.life = 0;
    this.maxLife = maxLife;
    this.type = type; // 'pixel', 'smoke', 'glow', 'magnetic'
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life++;
    this.alpha = 1 - (this.life / this.maxLife);
  }

  draw(ctx, cameraX) {
    // Glow particles use a pre-rendered radial sprite (render-cache.js) — softer
    // falloff than the old shadowBlur, at a tiny fraction of the cost (shadowBlur
    // runs a gaussian per draw call; bursts spawn dozens of these per frame).
    if (this.type === 'glow' && typeof RenderCache !== 'undefined') {
      const spr = RenderCache.glowSprite(this.color, 8);
      if (spr) {
        const d = this.size * 4.5;
        ctx.globalAlpha = this.alpha;
        ctx.drawImage(spr, this.x - cameraX - d / 2, this.y - d / 2, d, d);
        ctx.globalAlpha = 1;
        return;
      }
    }
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;

    if (this.type === 'glow') {
      ctx.shadowBlur = this.size * 2;
      ctx.shadowColor = this.color;
    }

    ctx.beginPath();
    ctx.arc(this.x - cameraX, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Particle System Manager
class ParticleEngine {
  constructor() {
    this.particles = [];
  }

  clear() {
    this.particles = [];
  }

  spawn(x, y, color, size, vx, vy, maxLife, type = 'pixel') {
    this.particles.push(new Particle(x, y, color, size, vx, vy, maxLife, type));
  }

  spawnBurst(x, y, color, count, speed, size = 3, type = 'pixel') {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const mag = (0.3 + Math.random() * 0.7) * speed;
      this.spawn(
        x, y, color,
        size * (0.5 + Math.random() * 0.5),
        Math.cos(angle) * mag,
        Math.sin(angle) * mag,
        15 + Math.random() * 20,
        type
      );
    }
  }

  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update();
      if (this.particles[i].life >= this.particles[i].maxLife) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw(ctx, cameraX) {
    for (const p of this.particles) {
      p.draw(ctx, cameraX);
    }
  }
}

const Particles = new ParticleEngine();

// ---------------------------------------------------------------------------
// Speech variety: every callout pulls a RANDOM line from a themed pool, never
// the same one twice in a row, so the game keeps feeling fresh. Add freely.
// ---------------------------------------------------------------------------
const SPEECH_POOLS = {
  jump: [
    "BOING!", "HUP!", "WHEE!", "BOUNCE!", "SPRONG!", "UP UP!", "HOPPA!", "BWOMP!",
    "SKY BOOP!", "LEG DAY!", "TOES AWAY!", "ANTI-GRAV!", "MOON KNEES!", "HOPSCOTCH!",
    "FLY-ish!", "UPSY-DAISY!", "GRAVITY WHO?", "JUMP.exe!", "BOOTS GO BRR!", "LAUNCH LEGS!",
    "YOINK UP!", "KNEE BLAST!", "AIR TIME!", "I BELIEVE!", "SPROING-O!", "CLOUD TICKLE!"
  ],

  stomp: [
    "STOMP!", "SPLAT!", "BONK!", "POW!", "SQUISH!", "GOTCHA!", "BAM!", "YEET!",
    "BOOT TAX!", "DOWN YOU GO!", "FEET JUSTICE!", "SNEAKER SMASH!", "OOPS, BOOT!",
    "GRAVITY HELPED!", "PANCaked!", "TINY THUNDER!", "SOLE POWER!", "TOE-TALED!",
    "STOMP-O-MATIC!", "BUG REPORT!", "BONK RECEIPT!", "SURPRISE FLOOR!", "NOPE!", "SQUISHY MATH!"
  ],

  get: [
    "GET!", "NICE!", "SHINY!", "GRAB!", "YOINK!", "OOH!", "SWEET!", "GEM-TASTIC!", "MINE!",
    "SPACE LOOT!", "POCKETED!", "CHA-CHING!", "COSMIC COIN!", "GIMME!", "SPARKLE TAX!",
    "STAR SNACK!", "LOOT SCOOT!", "COLLECTED!", "TREASURE BOOP!", "OINK? COIN!", "SHINY ACQUIRED!",
    "RICH-ish!", "GALAXY TIP!", "THANKS, SPACE!", "FINDERS KEEPERS!", "SPARKLE GET!"
  ],

  powerup: [
    "POWER UP!", "LEVEL UP!", "BOOSTED!", "SUPERCHARGED!", "KA-CHING!", "MAX POWER!", "UPGRADE!",
    "JUICE MODE!", "BUFFED!", "BIG HOP ENERGY!", "SCIENCE!", "LIMIT BROKEN!", "HYPER HOP!",
    "ROCKET SOCKS!", "POWER SNACK!", "STATS GO UP!", "PATCHED!", "UNFAIR!", "TURBO BEANS!",
    "GLITCH? NAH!", "HOPPER 2.0!", "COSMIC SAUCE!", "FULL BATTERY!", "SPICY PHYSICS!", "CHARGED!"
  ],

  zap: [
    "ZAP!", "BZZT!", "CLING!", "MAGNET-O!", "SNAP!", "KRZZT!", "STICKY!",
    "SPARK SNACK!", "STATIC HUG!", "MAG-NICE!", "POLARITY PARTY!", "CURRENT MOOD!",
    "FIELD TRIP!", "BZZZAP!", "ION KNOW!", "SHOCKING!", "ELECTRO-BOOP!", "CLINGY!",
    "SCIENCE ZOT!", "WATT?!", "OHM MY!", "ATTRACTED!", "MAGNET HUG!", "BEEP-ZAP!", "ZORT!"
  ],

  whoosh: [
    "WHOOSH!", "VROOM!", "BLAST!", "FWOOSH!", "ZOOM!", "BRRRAP!", "TO THE MOON!",
    "NYOOM!", "FAST FEET!", "SPEEDY BEAN!", "COMET MODE!", "BYE FLOOR!", "AIR MAIL!",
    "WARP-ish!", "ZOOMIES!", "TURBO TUSH!", "DUST WHO?", "SPEED TAX!", "METEOR MOOD!",
    "FLOOR CANCELLED!", "ORBITS FEAR ME!", "GAS GAS!", "SPACE WIND!", "WHIZZ!", "FWOOM!"
  ],

  grip: [
    "GRIP!", "CLANK!", "DIG IN!", "HOLD ON!", "CRUNCH!", "TRACTION!", "BITE!",
    "STICKY BOOTS!", "NO SLIP!", "ICE WHO?", "CLING MODE!", "BOOT BRAKES!", "FRICTION FRIEND!",
    "ANCHOR FEET!", "GRABBY SOLES!", "LOCKED!", "SURFACE HUG!", "SKID DENIED!", "TREAD LIGHTLY!",
    "GRIPTASTIC!", "CLAW BOOTS!", "STAY PUT!", "NOPE, SLIDE!", "FLOOR FRIEND!", "BOOT GLUE!"
  ],

  bonk: [
    "BONK!", "OOF!", "OW!", "THWAP!", "DOINK!", "OUCH!", "WALL!",
    "HELMET TEST!", "FACE MEET WALL!", "NOTED!", "DATA POINT!", "SCIENCE HURTS!",
    "BOOPED TOO HARD!", "WALL SAYS HI!", "HEAD FIRST!", "MY BAD!", "THAT'S SOLID!",
    "CRANI-YUM!", "BRAIN BOUNCE!", "NO ENTRY!", "OOPSIE!", "STRUCTURAL YES!", "PAIN PING!"
  ],

  bump: [
    "BUMP!", "TONK!", "CLONK!", "DUNK!", "HEAD!", "CEILING!",
    "UPPER BONK!", "SKY SAID NO!", "CEILING TAX!", "LOW BRIDGE!", "HELMET BONK!",
    "TOPSIDE OOF!", "HEIGHT CHECK!", "NO FLY ZONE!", "DOME DOINK!", "ROOF BOOP!",
    "UPPERCUT WALL!", "BONK ABOVE!", "TOO TALL!", "SKULL TAP!", "CEILING HUG!", "AIRBRAKE!"
  ],

  land: [
    "TMP!", "THUD!", "TAP!", "THWMP!", "*dust*", "STICK!",
    "LANDED!", "FLOOR TIME!", "BOOT PRINT!", "NICE TOUCHDOWN!", "GRAVITY WON!", "SOFT-ish!",
    "DUST PUFF!", "FEET ONLINE!", "HELLO GROUND!", "SAFE-ish!", "TINY QUAKE!", "KNEES OK!",
    "STOMP-LITE!", "TOUCHDOWN!", "FLOOR HUG!", "PLANTED!", "BOOTS DOWN!", "SURFACE GET!"
  ],

  kaboom: [
    "KABOOM!", "BOOM!", "CRASH!", "SMASH!", "WIPEOUT!", "SPLAT!", "OW-CH!",
    "MISSION OOPS!", "BIG OOF!", "PHYSICS WON!", "SEND HELP!", "RESPAWN TIME!", "CHAOS!",
    "NOT IDEAL!", "RIP BOOTS!", "HOUSTON, OW!", "ERROR: OUCH!", "MY TRAJECTORY!", "CRATER MODE!",
    "SPICY LANDING!", "CALCULATED? NO!", "BOOM WITH FEELING!", "DUST NAP!", "BONKAGEDDON!", "RESET ME!"
  ],

  arrive: [
    "HERE WE GO!", "LET'S HOP!", "GAME ON!", "LIFTOFF!", "READY!", "ADVENTURE TIME!", "BOUNCE PARTY!",
    "STAR TIME!", "MISSION START!", "BOOTS READY!", "SPACE FACE ON!", "HOP TO IT!", "CADET MODE!",
    "FUEL? MAYBE!", "HELLO, COSMOS!", "GRAVITY LOADED!", "VECTOR CHECK!", "SCIENCE HAT ON!",
    "LET'S YEET!", "PLANET, PLEASE!", "ORBITS AHOY!", "START THE SPROING!", "BOOT SEQUENCE!", "GO TIME!"
  ],

  idle: [
    "Hmm…", "Any signals?", "So quiet…", "Snack time?", "Pretty stars.", "Now what?", "*yawns*",
    "Is it lunch?", "I spy a comet.", "Boop.", "Just vibing.", "Cosmic, man.", "Beep boop?",
    "Whistle…", "Counting stars.", "Tum te tum…", "Space is big.", "Wiggle wiggle.",
    "Gravity called.", "Still floating.", "Tiny orbit thoughts.", "I miss snacks.", "Helmet hair day.",
    "Do stars sneeze?", "Math is lurking.", "Boots are bored.", "Any asteroids?", "Hopper waiting.",
    "Space smells purple.", "Blink blink.", "Comet or crumb?", "Thinking noises.", "Boop pending.",
    "Standing by-ish.", "Orbitally awkward.", "My socks echo.", "No thoughts, just stars.",
    "Can I eat moon?", "Astro-napping.", "Void check.", "Still cute.", "Tiny space pause.",
    "404: snacks not found.", "Did I save?", "Gravity is clingy.", "Friction gossip.", "Starstruck."
  ],

  // Navigator — astronaut lingo
  navAim: [
    "Locked on!", "Nose on target!", "Aligning, over.", "Pointy end that way!", "Target acquired!", "On the money!",
    "Vector vibes!", "Aim-ish!", "Compass says yep!", "Face the rock!", "Planet in sights!", "Trajectory tea!",
    "Pointy mode!", "Bearing acquired!", "Line it up!", "Math points there!", "Nose knows!", "Target booped!",
    "Orbit says hi!", "Angle wrangled!", "Rotation rationed!", "Aim juice ready!", "Coordinates cuddled!", "Bullseye-ish!"
  ],

  navThrust: [
    "Burnin' fuel!", "Punch it!", "Full burn, baby!", "Throttle up!", "Engines HOT!", "Pushin' tin!", "Hold my space-juice!",
    "Fire the spicy end!", "Newton time!", "Boost beans!", "Delta-v me!", "Thrust issues!", "Engine sneeze!",
    "Zoom budget spent!", "Fuel confetti!", "Rocket socks!", "Burn, baby!", "Pushy physics!", "Acceleration nation!",
    "No brakes, vibes!", "Exhaust party!", "Main engine: YES!", "Orbital shove!", "Fuel go whoosh!", "Speed soup!"
  ],

  navWait: [
    "Coastin'…", "Just driftin'.", "Ridin' the void.", "Patience, cadet.", "Tick tock in space.", "Zero-G nap.", "Wheee, no gravity!",
    "Let math cook.", "Orbit simmering.", "Waiting in style.", "Void lounge.", "Snack window?", "Coast toast.",
    "Hands off, hero.", "Drift responsibly.", "Space patience.", "Trajectory loading…", "Momentum babysitting.",
    "Nothing to see.", "Time soup.", "Floating politely.", "Physics buffering.", "Tiny orbit nap.", "Still calculating vibes."
  ],

  navCruise: [
    "Cruising now!", "Smooth orbit!", "In the groove!", "Orbit locked, baby!", "Nice and steady.", "Feet up, coasting.",
    "Glide mode!", "Silky space!", "Stable-ish!", "Orbital oatmeal!", "Zero drama!", "Smooth like moonbutter!",
    "Course is cozy.", "Comfy trajectory.", "Velocity behaved!", "Cruise juice!", "Orbit purrs.", "No wobble!",
    "Space highway!", "Drift deluxe!", "Cadet approved!", "Vector velvet!", "We vibin'.", "Steady spaghetti!"
  ],

  navLanding: [
    "Prepare for landing!", "Brace, brace!", "Touchdown soon!", "Landing gear — deploy!", "Hold your helmet!", "Comin' in hot!",
    "Ground incoming!", "Knees, prepare!", "Dust forecast!", "Boots to dirt!", "Careful-ish!", "Aim for soft!",
    "Planet hug soon!", "Surface RSVP!", "Gravity pickup!", "Helmet down!", "Tiny crash maybe!", "Touchdown tango!",
    "Lower the snacks!", "Descent party!", "Don’t lick the planet!", "Landing vibes!", "Floor appointment!", "Boots first!"
  ],

  navLightspeed: [
    "Closing on light speed!", "Ludicrous speed!", "We're warpin'!", "Einstein would faint!", "Time's gettin' weird!", "Almost plaid!", "Whoa — relativity!",
    "Causality who?", "Photon envy!", "Clock melted!", "Speed limit? cute.", "Time noodles!", "Mass says nope!",
    "Warp sprinkles!", "Relativity snack!", "Calendar drift!", "Fast enough-ish!", "Light says hey!", "Space streaks!",
    "Helmet stretching!", "Physics squints!", "Too fast for pants!", "Velocity goblin!", "Temporal boop!", "Zoom beyond zoom!"
  ],

  navDeepSpace: [
    "Whoa — deep space!", "Lost the planets!", "Re-aim, cadet!", "Out in the big black!", "Where'd everybody go?", "Too far, too far!",
    "Map got nervous!", "Signal is soup!", "Stars everywhere!", "Void says hi.", "Planet? Planet?", "Compass crying!",
    "Coordinates sneezed!", "Big empty energy.", "Return receipt?", "Deep whoops!", "Cosmic oopsie!", "Space got bigger!",
    "Echo location?", "Mission got spicy!", "Lost but stylish.", "Hello, nothing!", "Too much universe!", "Bring snacks!"
  ],

  // Mob Survival — the critters trash-talk
  mobChatter: [
    "GRRR!", "ROAR!", "SNARL!", "BLORP!", "BEEP BEEP!", "RAWR!", "HISS!", "SKREE!", "ZZT!", "MUNCH?",
    "HOWL!", "CHOMP!", "GROWL!", "SQUEAK!", "GNAR!", "BORK!", "HONK!", "SCREECH!", "feed me!", "intruder!",
    "snack o'clock!", "you look tasty!", "rawr means hi!", "my planet!", "boop you!", "grr-eetings!"
  ],
  mobDeath: [
    "OOF!", "SPLAT!", "BYE!", "DEFEATED!", "K.O.!", "POP!", "NOOO!", "*poof*", "X_X", "GG!",
    "OW-CH!", "ZONK!", "DOWN I GO!", "YEET'D!", "RIP me!", "well, rude!", "see ya!", "blub…", "*sparkles*", "respawn?"
  ],
  mobRave: [
    "AAH, DISCO!", "TOO SHINY!", "RETREAT!", "NOPE NOPE!", "MY EYES!", "FLEE!", "rave bad!", "spooky lights!", "abort!", "run away!"
  ]
};

const SPEECH = {
  _last: {},
  // "Slow" moments (standing idle, watching the navigator) can read longer, funnier
  // lines; everything else is fast platformer action that wants a snappy short word.
  _slow: new Set(["idle", "navAim", "navThrust", "navWait", "navCruise", "navLanding", "navLightspeed", "navDeepSpace"]),
  pick(pool) {
    const arr = SPEECH_POOLS[pool];
    if (!arr || !arr.length) return pool;
    if (arr.length === 1) return arr[0];
    const slow = this._slow.has(pool);
    // Sample a few candidates (never the last line) and keep the shortest for fast
    // action / the longest for calm moments — a soft length bias that keeps variety.
    let best = null;
    for (let s = 0; s < 3; s++) {
      let idx, tries = 0;
      do { idx = Math.floor(Math.random() * arr.length); tries++; } while (arr[idx] === this._last[pool] && tries < 6);
      const cand = arr[idx];
      if (best === null || (slow ? cand.length > best.length : cand.length < best.length)) best = cand;
    }
    this._last[pool] = best;
    return best;
  }
};

// Comic Onomatopoeia Word Bubble Class (Hilo comic-strip style)
class ComicBubble {
  constructor(x, y, text, type = 'rounded', color = '#fbf3da', vy = -0.75, opts = {}) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.type = type; // 'rounded', 'jagged', 'cloud'
    this.color = color;
    this.vx = (Math.random() - 0.5) * 0.5;
    this.vy = vy;
    this.life = 0;
    this.maxLife = opts.maxLife || 45; // default ~0.75s; big hits (KABOOM) linger longer
    this.scaleMul = opts.scale || 1;   // size multiplier for emphasis
    this.angle = (Math.random() - 0.5) * 0.16; // dynamic hand-drawn tilt angle
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life++;
  }

  draw(ctx, cameraX) {
    ctx.save();

    // Comic popup animation scale profile
    let s = 1.0;
    if (this.life < 6) {
      s = this.life / 6; // scale in
    } else if (this.life > this.maxLife - 8) {
      s = (this.maxLife - this.life) / 8; // scale out
    }
    if (s <= 0) s = 0.01;

    ctx.translate(this.x - cameraX, this.y);
    ctx.scale(s * this.scaleMul, s * this.scaleMul);
    ctx.rotate(this.angle);

    // Big comic IMPACT lettering — no speech box, just bold outlined onomatopoeia over a
    // starburst flash. The signature "POW!" pop, reserved for high-reward moments.
    if (this.type === 'pop') {
      ctx.font = "bold 13px 'Press Start 2P', monospace";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const tw = ctx.measureText(this.text).width;
      const outerR = tw * 0.6 + 16;
      const innerR = outerR * 0.6;
      const spikes = 14;
      ctx.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const theta = (i * Math.PI) / spikes - Math.PI / 2;
        const r = (i % 2 === 0) ? outerR : innerR;
        ctx.lineTo(Math.cos(theta) * r, Math.sin(theta) * r * 0.7);
      }
      ctx.closePath();
      ctx.fillStyle = this.color;
      ctx.strokeStyle = '#15233e';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.fill();
      ctx.stroke();
      // Drop shadow, then thick-ink outlined bright lettering on top of the burst.
      ctx.fillStyle = 'rgba(11,16,34,0.5)';
      ctx.fillText(this.text, 2.5, 3);
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#15233e';
      ctx.strokeText(this.text, 0, 0);
      ctx.fillStyle = '#fffbe6';
      ctx.fillText(this.text, 0, 0);
      ctx.restore();
      return;
    }

    ctx.font = "bold 9px 'Press Start 2P', monospace";
    const textWidth = ctx.measureText(this.text).width;
    const w = textWidth + 16;
    const h = 20;

    // 1. Dynamic comic drop shadow (offset offset)
    ctx.fillStyle = 'rgba(11, 16, 34, 0.45)';
    ctx.beginPath();
    this.drawPath(ctx, w, h, 2.5, 2.5);
    ctx.fill();

    // 2. Thick Ink outer border
    ctx.strokeStyle = '#15233e';
    ctx.lineWidth = 3;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    this.drawPath(ctx, w, h);
    ctx.fill();
    ctx.stroke();

    // Extra bubble details for Cloud thought type
    if (this.type === 'cloud') {
      ctx.fillStyle = this.color;
      ctx.strokeStyle = '#15233e';
      ctx.lineWidth = 2.5;

      // Draw bubble trailing links
      ctx.beginPath();
      ctx.arc(-8, h / 2 + 6, 3.5, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();

      ctx.beginPath();
      ctx.arc(-14, h / 2 + 11, 2, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }

    // 3. Inner JRPG thin accent line
    ctx.strokeStyle = 'rgba(21, 35, 62, 0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    this.drawPath(ctx, w - 3, h - 3);
    ctx.stroke();

    // 4. Centered block text
    ctx.fillStyle = '#15233e';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.text, 0, 1.5);

    ctx.restore();
  }

  drawPath(ctx, w, h, dx = 0, dy = 0) {
    const ox = dx;
    const oy = dy;

    if (this.type === 'jagged') {
      // Exploding Starburst path for actions like STOMP, ZAP, BONK
      const points = 12;
      const innerW = w * 0.42;
      const innerH = h * 0.42;
      const outerW = w * 0.65;
      const outerH = h * 0.65;
      for (let i = 0; i < points * 2; i++) {
        const theta = (i * Math.PI) / points;
        const rx = (i % 2 === 0) ? outerW : innerW;
        const ry = (i % 2 === 0) ? outerH : innerH;
        const px = ox + Math.cos(theta) * rx;
        const py = oy + Math.sin(theta) * ry;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else if (this.type === 'cloud') {
      // Soft puffy thought pill sized to the text (the thought-trail dots are
      // drawn separately in draw()). Stadium radius keeps it readable at any width.
      ctx.roundRect(ox - w / 2, oy - h / 2, w, h, h / 2);
    } else {
      // Rounded chat box with short center pointer tail
      ctx.roundRect(ox - w / 2, oy - h / 2, w, h, 6);
      ctx.moveTo(ox - 6, oy + h / 2 - 1);
      ctx.lineTo(ox - 2, oy + h / 2 + 5);
      ctx.lineTo(ox + 4, oy + h / 2 - 1);
    }
  }
}

// Global Comic Onomatopoeia Manager
class ComicBubbleEngine {
  constructor() {
    this.bubbles = [];
  }

  clear() {
    this.bubbles = [];
  }

  spawn(x, y, text, type = 'rounded', color = '#fbf3da', vy = -0.75, opts = {}) {
    this.bubbles.push(new ComicBubble(x, y, text, type, color, vy, opts));
  }

  // Big impact pop-text (type 'pop'). Capped so a frantic moment can't stack a wall of
  // letters on screen — at most a few live at once; extra triggers fall back to particles.
  pop(x, y, text, color = '#facc15', scale = 1.15) {
    let live = 0;
    for (const b of this.bubbles) if (b.type === 'pop') live++;
    if (live >= 2) return;
    this.bubbles.push(new ComicBubble(x, y, text, 'pop', color, -0.9, { maxLife: 60, scale }));
  }

  update() {
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      this.bubbles[i].update();
      if (this.bubbles[i].life >= this.bubbles[i].maxLife) {
        this.bubbles.splice(i, 1);
      }
    }
  }

  draw(ctx, cameraX) {
    for (const cb of this.bubbles) {
      cb.draw(ctx, cameraX);
    }
  }
}

const ComicBubbles = new ComicBubbleEngine();

// ---------------------------------------------------------------------------
// MOB SURVIVAL: planet-themed critters you stomp/shoot for points. Emoji-drawn
// so each world feels distinct, with their own little trash-talk balloons.
// ---------------------------------------------------------------------------
// Per-planet mob SPECIES (drawn creatures, not emoji): Earth = real critters,
// the rest = themed aliens (tinted by the planet's accent color).
const MOB_THEMES = [
  ["hog", "snake", "critter"],   // 0 Earth — earthly critters
  ["blob", "floater"],            // 1 Moon — aliens
  ["blob", "floater"],            // 2 Jupiter — fiery aliens
  ["critter", "blob"],            // 3 Glacies — frost aliens (icy critter + blob)
  ["bot", "floater"],             // 4 Mag-Net — machine aliens
  ["blob", "floater"]             // 5 Asteroid Forge — drifters
];

class Mob {
  constructor(x, y, species, accent, aggro) {
    this.species = species || 'blob';
    this.accent = accent || '#a78bfa';
    this.aggro = aggro || 1; // per-world aggression scale (Earth gentle, Jupiter mean)
    if (this.species === 'snake') { this.w = 32; this.h = 20; }
    else if (this.species === 'hog') { this.w = 32; this.h = 24; }
    else if (this.species === 'floater') { this.w = 28; this.h = 26; }
    else { this.w = 26; this.h = 26; }
    this.x = x; this.y = y;
    this.vy = 0;
    this.dir = (Math.random() < 0.5 ? -1 : 1);
    this.speed = 0.5 + Math.random() * 0.5; // gentler base pace (was 0.7..1.5)
    this.onGround = false;
    this.hopTimer = 40 + Math.random() * 90;
    this.sayText = ""; this.sayTimer = 0;
    this.hitFlash = 0;
    // Animation state — gives the creature life (walk cycle, blinking, look-at).
    this.animTime = Math.random() * Math.PI * 2;
    this.blinkTimer = 60 + Math.random() * 160;
    this.eyeDir = this.dir;
    // Per-species behavior state (charge / strike / dive / scan timers).
    this.behaviorTimer = 20 + Math.random() * 60;
    this.charging = 0;
    this.windupTimer = 0;   // telegraph: brace/coil before an attack
    this.attackPower = 1;   // contact knockback multiplier (boosted mid-attack)
    this.diveTimer = 0;
    this.scanning = false;
    this.darting = false;
  }
  say(t) { this.sayText = t; this.sayTimer = 70; }
  _solid(tilemap, x, y) {
    const cL = Math.floor(x / TILE_SIZE), cR = Math.floor((x + this.w) / TILE_SIZE);
    const rT = Math.floor(y / TILE_SIZE), rB = Math.floor((y + this.h) / TILE_SIZE);
    if (cL < 0 || !tilemap[0] || cR >= tilemap[0].length || rB >= tilemap.length) return true;
    if (rT < 0) return false;
    for (let r = rT; r <= rB; r++) for (let c = cL; c <= cR; c++) if (tilemap[r] && (tilemap[r][c] === 1 || tilemap[r][c] === 10)) return true;
    return false;
  }
  _tileIs(tilemap, px, py, val) {
    if (!tilemap) return false;
    const c = Math.floor(px / TILE_SIZE), r = Math.floor(py / TILE_SIZE);
    return !!(tilemap[r] && tilemap[r][c] === val);
  }
  // Single-point solid test (block or breakable). Used for the wall/floor probes so we can
  // sample specific spots (above the feet, just past the leading edge) instead of the whole
  // AABB — a box test would always include the floor row underfoot and read "wall everywhere".
  _solidPoint(tilemap, px, py) {
    if (!tilemap) return false;
    const c = Math.floor(px / TILE_SIZE), r = Math.floor(py / TILE_SIZE);
    return !!(tilemap[r] && (tilemap[r][c] === 1 || tilemap[r][c] === 10));
  }
  update(tilemap, player, flee) {
    const toward = (player.x > this.x ? 1 : -1);
    this.dir = flee ? -toward : toward;
    this.eyeDir = toward;
    this.animTime += this.onGround ? 0.22 : 0.12;
    if (--this.blinkTimer <= 0) this.blinkTimer = 70 + Math.random() * 170;
    this.vy += (this.species === 'floater') ? 0.22 : 0.5; // floaters drift lazily

    // --- Per-species behavior: each creature plays differently; aggression scales by world.
    const dx = player.x - this.x, dy = player.y - this.y;
    const adx = Math.abs(dx), dist = Math.hypot(dx, dy);
    const ag = this.aggro || 1;
    this.behaviorTimer--;
    const hadWindup = this.windupTimer > 0;
    if (this.windupTimer > 0) this.windupTimer--;
    const windupDone = hadWindup && this.windupTimer === 0; // telegraph just finished → attack
    let moveSpeed = this.speed;
    this.attackPower = 1;
    switch (this.species) {
      case 'hog': // CHARGE: line up level, brace (wind-up tell), then bull-rush with a dust trail.
        if (this.charging > 0) {
          this.charging--; moveSpeed = this.speed * (1.7 + 0.7 * ag); this.attackPower = 1.8;
          if (typeof Particles !== 'undefined' && Math.random() < 0.6)
            Particles.spawn(this.x + this.w / 2 - this.eyeDir * 8, this.y + this.h - 2, '#cbd5e1', 2.4, -this.eyeDir * 0.8, -0.5, 16, 'glow');
        } else if (this.windupTimer > 0) {
          moveSpeed = 0; // brace in place (the tell)
        } else if (this.onGround && !flee && Math.abs(dy) < TILE_SIZE && adx > TILE_SIZE * 1.2 && adx < TILE_SIZE * 6 && this.behaviorTimer <= 0) {
          this.windupTimer = Math.round(18 / Math.max(1, ag)); this.behaviorTimer = Math.round(300 / ag);
          if (typeof ComicBubbles !== 'undefined') ComicBubbles.pop(this.x + this.w / 2, this.y - 4, "!", "#ef4444", 0.95);
        }
        if (windupDone) this.charging = 28;
        break;
      case 'snake': // STRIKE: coil back (tell), then a fast lunge.
        if (this.charging > 0) { this.charging--; moveSpeed = this.speed * (1.9 + 0.6 * ag); this.attackPower = 1.4; }
        else if (this.windupTimer > 0) { moveSpeed = -this.speed * 0.45; } // recoil away = wind-up
        else if (this.onGround && !flee && dist < TILE_SIZE * (2.0 + 0.5 * ag) && this.behaviorTimer <= 0) {
          this.windupTimer = 16; this.behaviorTimer = Math.round(210 / ag); // readable tell
          if (typeof ComicBubbles !== 'undefined') ComicBubbles.pop(this.x + this.w / 2, this.y - 4, "!", "#ef4444", 0.9);
        }
        if (windupDone) { this.charging = 14; this.vy = -4; moveSpeed = this.speed * (1.9 + 0.6 * ag); this.attackPower = 1.4; }
        break;
      case 'blob': // BOUNCY: a gelatinous hop on every landing.
        if (this.onGround) this.vy = -5.5;
        break;
      case 'critter': // SKITTISH: quick darts punctuated by little pauses.
        if (this.behaviorTimer <= 0) { this.behaviorTimer = 30 + Math.random() * 40; this.darting = Math.random() < 0.6; }
        moveSpeed = this.darting ? this.speed * (1.2 + 0.3 * ag) : this.speed * 0.4;
        if (this.onGround && this.darting && Math.random() < 0.08) this.vy = -5;
        break;
      case 'bot': // MARCHER: steady pace, pausing now and then to "scan".
        if (this.behaviorTimer <= 0) { this.behaviorTimer = 80 + Math.random() * 60; this.scanning = !this.scanning; }
        moveSpeed = this.scanning ? 0 : this.speed * 0.9;
        break;
      case 'floater': // DIVE-BOMB: hover, then swoop down toward the cadet.
        if (this.behaviorTimer <= 0 && adx < TILE_SIZE * 5) { this.behaviorTimer = Math.round(240 / ag); this.diveTimer = 26; }
        if (this.diveTimer > 0) { this.diveTimer--; this.vy += 0.9; moveSpeed = this.speed * (1.3 + 0.3 * ag); this.attackPower = 1.2; }
        break;
    }

    // Horizontal move: turn at walls, and refuse to step onto a crater (gap) or spikes.
    // All probes sample POINTS at the leading edge (not the whole AABB) so the floor the mob
    // stands on never counts as a "wall" — that would freeze it on flat ground.
    const nx = this.x + this.dir * moveSpeed;
    const lead = this.dir > 0 ? nx + this.w : nx;            // leading edge x
    const footY = this.y + this.h + 4;                       // just below the feet, at the leading edge
    // Wall = solid/breakable at body height ahead (sampled above the feet so the floor is excluded).
    const wallAhead = this._solidPoint(tilemap, lead, this.y + 4) || this._solidPoint(tilemap, lead, this.y + this.h - 6);
    const spikeAhead = this._tileIs(tilemap, lead, this.y + this.h / 2, 2) || this._tileIs(tilemap, lead, this.y + this.h - 6, 2);
    const floorAhead = this._solidPoint(tilemap, lead, footY); // ground to step onto at the leading edge?
    const floorSpike = this._tileIs(tilemap, lead, footY, 2);
    if (wallAhead || spikeAhead) {
      if (wallAhead && !spikeAhead && this.onGround && !flee && Math.random() < 0.6) this.vy = -7; // hop a wall
      else this.dir *= -1;                                   // turn at a wall or spikes
    } else if (this.onGround && (!floorAhead || floorSpike)) {
      this.dir *= -1;                                        // brink of a crater/gap or spike floor → turn back
    } else {
      this.x = nx;
    }

    // Vertical integrate + ground resolve.
    this.y += this.vy;
    this.onGround = false;
    if (this._solid(tilemap, this.x, this.y)) {
      if (this.vy > 0) { this.y = Math.floor((this.y + this.h) / TILE_SIZE) * TILE_SIZE - this.h; this.onGround = true; }
      else if (this.vy < 0) { this.y = (Math.floor(this.y / TILE_SIZE) + 1) * TILE_SIZE; }
      this.vy = 0;
    }

    if (this.onGround && !flee && player.y < this.y - TILE_SIZE && Math.random() < 0.05) this.vy = -8.5;
    // Floaters bob-hop to stay aloft.
    if (this.species === 'floater' && this.onGround && Math.random() < 0.08) this.vy = -5;

    if (this.sayTimer > 0) this.sayTimer--;
    if (this.hitFlash > 0) this.hitFlash--;
    if (this.sayTimer <= 0 && Math.random() < 0.004) this.say(SPEECH.pick(flee ? 'mobRave' : 'mobChatter'));
  }

  // White cartoon eyes that track the cadet and blink. spread 0 = a single cyclops eye.
  _eyes(ctx, cx, cy, spread, r, blink) {
    const look = this.eyeDir * r * 0.35;
    const xs = spread === 0 ? [0] : [-spread, spread];
    for (const ox of xs) {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx + ox, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = '#0b1224'; ctx.stroke();
      if (blink) {
        ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx + ox - r, cy); ctx.lineTo(cx + ox + r, cy); ctx.stroke();
      } else {
        ctx.fillStyle = '#0b1224';
        ctx.beginPath(); ctx.arc(cx + ox + look, cy, r * 0.52, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  drawSpecies(ctx, cx, cy, footY, t, blink) {
    ctx.lineJoin = 'round'; ctx.lineWidth = 2; ctx.strokeStyle = '#0b1224';
    const ed = this.eyeDir;
    switch (this.species) {
      case 'hog': {
        const r = this.w * 0.42;
        ctx.fillStyle = '#6b4a35';
        [-r * 0.6, -r * 0.2, r * 0.2, r * 0.6].forEach((lx, i) => { const ph = Math.sin(t + i) * 2.5; ctx.fillRect(cx + lx - 2, footY - 7 + Math.max(0, ph), 4, 7); });
        ctx.fillStyle = '#9a6b4f'; ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.74, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx - r * 0.5, cy - r * 0.5); ctx.lineTo(cx - r * 0.8, cy - r); ctx.lineTo(cx - r * 0.2, cy - r * 0.65); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + r * 0.5, cy - r * 0.5); ctx.lineTo(cx + r * 0.8, cy - r); ctx.lineTo(cx + r * 0.2, cy - r * 0.65); ctx.closePath(); ctx.fill(); ctx.stroke();
        const snx = cx + ed * r * 0.6;
        ctx.fillStyle = '#c08a6a'; ctx.beginPath(); ctx.ellipse(snx, cy + r * 0.12, r * 0.32, r * 0.26, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#4a2f20'; ctx.beginPath(); ctx.arc(snx - 2, cy + r * 0.12, 1.4, 0, 7); ctx.arc(snx + 2, cy + r * 0.12, 1.4, 0, 7); ctx.fill();
        this._eyes(ctx, cx + ed * r * 0.18, cy - r * 0.22, r * 0.26, r * 0.2, blink);
        break;
      }
      case 'snake': {
        const segR = this.h * 0.5;
        for (let i = 4; i >= 0; i--) {
          const px = cx + ed * (this.w * 0.34 - i * this.w * 0.17);
          const py = cy + Math.sin(t * 0.9 + i * 0.9) * 4;
          ctx.fillStyle = i === 0 ? '#22c55e' : (i % 2 ? '#4ade80' : '#37b067');
          ctx.beginPath(); ctx.arc(px, py, segR * (1 - i * 0.07), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          if (i === 0) {
            this._eyes(ctx, px, py - segR * 0.25, segR * 0.3, segR * 0.22, blink);
            ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.moveTo(px + ed * segR, py + segR * 0.25); ctx.lineTo(px + ed * segR * 1.7, py + segR * 0.4); ctx.stroke();
            ctx.strokeStyle = '#0b1224'; ctx.lineWidth = 2;
          }
        }
        break;
      }
      case 'critter': {
        const r = this.w * 0.4;
        ctx.fillStyle = '#a1815c';
        [-r * 0.45, r * 0.45].forEach((lx, i) => { const ph = Math.sin(t + i * Math.PI) * 2.5; ctx.fillRect(cx + lx - 2, footY - 6 + Math.max(0, ph), 4, 6); });
        ctx.strokeStyle = '#a1815c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - ed * r * 0.7, cy); ctx.quadraticCurveTo(cx - ed * r * 1.4, cy - r * 0.2, cx - ed * r * 1.1, cy - r * 0.8); ctx.stroke();
        ctx.lineWidth = 2; ctx.strokeStyle = '#0b1224';
        ctx.fillStyle = '#d6b88f'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx - r * 0.55, cy - r * 0.7, r * 0.3, 0, 7); ctx.arc(cx + r * 0.55, cy - r * 0.7, r * 0.3, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#f0d9b8'; ctx.beginPath(); ctx.arc(cx - r * 0.55, cy - r * 0.7, r * 0.15, 0, 7); ctx.arc(cx + r * 0.55, cy - r * 0.7, r * 0.15, 0, 7); ctx.fill();
        this._eyes(ctx, cx, cy - r * 0.05, r * 0.4, r * 0.26, blink);
        ctx.fillStyle = '#4a2f20'; ctx.beginPath(); ctx.arc(cx + ed * 2, cy + r * 0.38, 2, 0, 7); ctx.fill();
        break;
      }
      case 'bot': {
        const r = this.w * 0.42;
        ctx.fillStyle = '#475569'; ctx.fillRect(cx - r, footY - 6, r * 2, 6); ctx.strokeRect(cx - r, footY - 6, r * 2, 6);
        ctx.fillStyle = this.accent; ctx.beginPath(); ctx.roundRect(cx - r, cy - r * 0.85, r * 2, r * 1.6, 5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; [[-r * 0.8, -r * 0.6], [r * 0.8, -r * 0.6], [-r * 0.8, r * 0.5], [r * 0.8, r * 0.5]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.arc(cx + dx, cy + dy, 1.6, 0, 7); ctx.fill(); });
        ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.85); ctx.lineTo(cx, cy - r * 1.35); ctx.stroke();
        ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(cx, cy - r * 1.45, 2.5, 0, 7); ctx.fill();
        ctx.fillStyle = blink ? '#1e293b' : '#fde047'; ctx.beginPath(); ctx.roundRect(cx - r * 0.6, cy - r * 0.2, r * 1.2, r * 0.5, 3); ctx.fill(); ctx.stroke();
        if (!blink) { ctx.fillStyle = '#0b1224'; ctx.beginPath(); ctx.arc(cx + ed * r * 0.3, cy + r * 0.05, r * 0.16, 0, 7); ctx.fill(); }
        break;
      }
      case 'floater': {
        const r = this.w * 0.46;
        const by = cy + Math.sin(t * 0.6) * 3;
        ctx.strokeStyle = this.accent; ctx.lineWidth = 2.5;
        for (let i = -2; i <= 2; i++) { const tx0 = cx + i * r * 0.35; ctx.beginPath(); ctx.moveTo(tx0, by + r * 0.4); ctx.quadraticCurveTo(tx0 + Math.sin(t + i) * 4, by + r, tx0 + Math.sin(t + i) * 6, by + r * 1.5); ctx.stroke(); }
        ctx.lineWidth = 2; ctx.strokeStyle = '#0b1224';
        ctx.fillStyle = this.accent; ctx.beginPath(); ctx.arc(cx, by, r, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(cx, by, r * 0.7, r * 0.16, 0, 0, Math.PI * 2); ctx.fill();
        this._eyes(ctx, cx, by - r * 0.35, r * 0.38, r * 0.18, blink);
        break;
      }
      default: { // blob
        const r = this.w * 0.46;
        const wob = Math.sin(t) * 0.06;
        ctx.fillStyle = this.accent;
        ctx.beginPath(); ctx.ellipse(cx, cy, r * (1 + wob), r * (1 - wob), 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx - r * 0.5, cy + r * 0.7, r * 0.18, 0, Math.PI * 2); ctx.arc(cx + r * 0.4, cy + r * 0.8, r * 0.14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.ellipse(cx - r * 0.3, cy - r * 0.4, r * 0.3, r * 0.18, -0.5, 0, Math.PI * 2); ctx.fill();
        this._eyes(ctx, cx, cy - r * 0.15, r * 0.5, r * 0.2, blink);
        this._eyes(ctx, cx, cy + r * 0.3, 0, r * 0.18, blink);
        break;
      }
    }
  }

  draw(ctx, cameraX) {
    const cx = this.x + this.w / 2 - cameraX;
    const cy = this.y + this.h / 2;
    const footY = this.y + this.h;
    const blink = this.blinkTimer < 7;

    // Soft shadow (unscaled).
    ctx.save();
    ctx.globalAlpha = 0.22; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(cx, footY, this.w * 0.42, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Squash/stretch from vertical speed, anchored at the feet.
    ctx.save();
    // Wind-up tell: a brace-shake + red glow right before a charge/strike.
    if (this.windupTimer > 0) {
      ctx.translate(Math.sin(this.animTime * 3) * 1.6, 0);
      ctx.fillStyle = 'rgba(239,68,68,0.18)';
      ctx.beginPath(); ctx.arc(cx, cy, this.w * 0.72, 0, Math.PI * 2); ctx.fill();
    }
    const syS = 1 + Math.max(-0.18, Math.min(0.22, -this.vy * 0.016));
    ctx.translate(cx, footY); ctx.scale(1 / syS, syS); ctx.translate(-cx, -footY);
    this.drawSpecies(ctx, cx, cy, footY, this.animTime, blink);
    if (this.hitFlash > 0) {
      ctx.globalAlpha = 0.55 * (this.hitFlash / 6); ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx, cy, this.w * 0.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    if (this.sayTimer > 0 && this.sayText) {
      ctx.save();
      ctx.font = "7px 'Press Start 2P', monospace";
      const tw = ctx.measureText(this.sayText).width, bw = tw + 10, bh = 13;
      const bx = cx - bw / 2, by = this.y - bh - 5;
      ctx.fillStyle = '#0b1022'; ctx.beginPath(); ctx.roundRect(bx - 2, by - 2, bw + 4, bh + 4, 4); ctx.fill();
      ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 3); ctx.fill();
      ctx.fillStyle = '#15233e'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(this.sayText, cx, by + bh / 2 + 0.5);
      ctx.restore();
    }
  }
}

class Projectile {
  constructor(x, y, vx) { this.x = x; this.y = y; this.vx = vx; this.life = 0; this.maxLife = 60; this.dead = false; }
  update(tilemap) {
    this.x += this.vx; this.life++;
    const c = Math.floor(this.x / TILE_SIZE), r = Math.floor(this.y / TILE_SIZE);
    if (tilemap[r] && tilemap[r][c] === 1) this.dead = true;
    if (this.life >= this.maxLife) this.dead = true;
  }
  draw(ctx, cameraX) {
    ctx.save();
    ctx.fillStyle = '#facc15'; ctx.shadowBlur = 8; ctx.shadowColor = '#f59e0b';
    ctx.beginPath(); ctx.arc(this.x - cameraX, this.y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.4;
    ctx.beginPath(); ctx.arc(this.x - cameraX - Math.sign(this.vx) * 6, this.y, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

// Drifting space debris ("wonder pieces") — leftover chunks from old crashes that float
// across space-y worlds and chip the hopper's health on contact. Not affected by gravity;
// it drifts in a straight line + slowly tumbles, and shatters when it hits the cadet.
class Debris {
  constructor(x, y, vx, vy, size) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.w = size; this.h = size;
    this.angle = (typeof Math !== 'undefined' ? Math.random() : 0) * Math.PI * 2;
    this.spin = (Math.random() - 0.5) * 0.06;
    this.shape = [];                       // jagged unit radii for a rocky silhouette
    for (let i = 0; i < 7; i++) this.shape.push(0.6 + Math.random() * 0.4);
    this.life = 480 + Math.random() * 360; // despawns eventually (it bounces, so won't drift off)
  }
  _solidAt(tilemap, px, py) {
    if (!tilemap) return false;
    const c = Math.floor(px / TILE_SIZE), r = Math.floor(py / TILE_SIZE);
    return !!(tilemap[r] && (tilemap[r][c] === 1 || tilemap[r][c] === 10));
  }
  update(tilemap) {
    this.angle += this.spin;
    this.life--;
    // Bounce off solid tiles AND breakable blocks (per-axis reflection, ~0.7 restitution).
    this.x += this.vx;
    const midY = this.y + this.h / 2;
    if (this._solidAt(tilemap, this.x + (this.vx > 0 ? this.w : 0), midY)) { this.x -= this.vx; this.vx = -this.vx * 0.7; this.spin = -this.spin; }
    this.y += this.vy;
    const midX = this.x + this.w / 2;
    if (this._solidAt(tilemap, midX, this.y + (this.vy > 0 ? this.h : 0))) { this.y -= this.vy; this.vy = -this.vy * 0.7; }
  }
  draw(ctx, cameraX) {
    const sx = this.x + this.w / 2 - cameraX, sy = this.y + this.h / 2, r = this.w / 2;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(this.angle);
    ctx.beginPath();
    for (let i = 0; i < this.shape.length; i++) {
      const a = (i / this.shape.length) * Math.PI * 2;
      const rr = r * this.shape[i];
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = '#6b7280';                          // gray rock
    ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#0b1224';     // comic ink outline
    ctx.lineJoin = 'round'; ctx.stroke();
    ctx.fillStyle = '#4b5563';                          // a crater dot
    ctx.beginPath(); ctx.arc(-r * 0.2, -r * 0.12, r * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

// A meteor in a meteor-shower event: falls from the sky under gravity at a slight angle,
// trailing fire, and bursts on the ground. Damages the cadet on contact unless sheltered.
class Meteor {
  constructor(x, y, vx, vy) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.w = 16; this.h = 16;
    this.angle = Math.atan2(vy, vx);
    this.dead = false;
  }
  update(tilemap) {
    this.vy += 0.35;                         // gravity
    this.x += this.vx; this.y += this.vy;
    this.angle = Math.atan2(this.vy, this.vx);
    const c = Math.floor((this.x + this.w / 2) / TILE_SIZE);
    const r = Math.floor((this.y + this.h) / TILE_SIZE);
    if (tilemap[r] && (tilemap[r][c] === 1 || tilemap[r][c] === 10)) { // hit ground/block
      this.dead = true; this.impactR = r; this.impactC = c;
    }
    if (this.y > 470) this.dead = true;
  }
  draw(ctx, cameraX) {
    const sx = this.x + this.w / 2 - cameraX, sy = this.y + this.h / 2;
    ctx.save();
    ctx.strokeStyle = 'rgba(251,146,60,0.5)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx - this.vx * 2.5, sy - this.vy * 2.5); ctx.lineTo(sx, sy); ctx.stroke();
    ctx.translate(sx, sy); ctx.rotate(this.angle);
    ctx.fillStyle = '#f59e0b'; ctx.strokeStyle = '#0b1224'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, this.w / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fde68a';
    ctx.beginPath(); ctx.arc(-2, -2, this.w / 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

// The Main Player Class (Swappable between Star & Hopper)
class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;

    this.charType = 'star'; // 'star' or 'hopper'
    this.onGround = false;
    this.isJumping = false;
    // Coyote time: frames of grace after walking off a ledge during which a jump still
    // fires. Invisible to skilled play, but removes the "I pressed jump and nothing
    // happened" unfairness that frustrates younger players on narrow platforms.
    this.coyoteFrames = 0;

    // Character dimensions
    this.w = 20;
    this.h = 32;
    this.scale = 1.0;
    this.mass = 1.0;
    this.jumpPower = 15;

    // Two-tier fuel:
    //  • THRUSTER (fuel/maxFuel) — a small working pool spent by powered abilities (cranked
    //    jumps, rocket, antigravity). Shown as the live gauge above the hopper.
    //  • TANK (tank/maxTank) — a finite reserve for the level. The thruster refills FROM the
    //    tank on the ground (no free regen); when the tank runs dry the thruster can't refill.
    //    Refills to full at level start (new Player) and from fuel-canister pickups.
    this.fuel = 100;
    this.maxFuel = 100;
    this.tank = 200;
    this.maxTank = 200;
    this.rocketPower = 40;
    this.magnetActive = false;
    this.isBraking = false; // Spiked boots engaged
    this.spikes = false;

    // Event flags for conditional engine
    this.hitEnemyThisFrame = false;
    this.touchingGroundType = 'earth';

    // Say bubble
    this.sayText = "";
    this.sayTimer = 0;
    this.sayReveal = 0;
    this.sayPrevLen = 0;

    // Split/Co-op coordinates control
    this.isStationary = false;
    this.facing = 1;

    // Health: the cadet can take a few hits (space debris, meteors, enemies each chip 1)
    // before the run ends, with brief invulnerability + knockback after each hit. Falling
    // out of bounds is still instant. Reset to full on every level start (new Player).
    this.maxHealth = 3;
    this.health = 3;
    this.invulnerableFrames = 0; // i-frames after a hit: blocks re-damage and blinks the sprite

    // Weapons: the cadet starts UNARMED. Find a blaster pickup (or break it out of a block)
    // to enable shooting with F. Null = can't shoot.
    this.weapon = null;
  }

  // Retro 80s-style speech balloon. opts: { emoji, shout, timer, dialogue }
  say(text, opts) {
    opts = opts || {};
    this.sayText = text;
    this.sayEmoji = opts.emoji || "";
    this.sayShout = !!opts.shout;       // big pixel-font arcade shout (e.g. "GET!")
    this.sayDialogue = !!opts.dialogue; // multi-line instruction bubble (wraps, lingers)
    this.sayTimer = opts.timer || (opts.dialogue ? 320 : 150);
    this.sayReveal = 0;                 // chars revealed so far (typewriter effect)
    this.sayPrevLen = 0;
  }

  clearSpeech() {
    this.sayText = "";
    this.sayTimer = 0;
    this.sayReveal = 0;
    this.sayPrevLen = 0;
  }

  updateSpeech() {
    if (this.sayTimer <= 0 || !this.sayText) return;

    this.sayTimer--;
    this.sayReveal = Math.min(this.sayText.length, (this.sayReveal || 0) + 0.55);
    const shownCount = Math.ceil(this.sayReveal);

    // Soft "blip" as each new glyph appears, classic JRPG textbox feel.
    if (shownCount > 0 && shownCount > (this.sayPrevLen || 0) && typeof SFX !== 'undefined' && SFX.playType) {
      if (Math.random() < 0.6) SFX.playType();
    }
    this.sayPrevLen = shownCount;
  }

  shouldSuppressSpeech() {
    try {
      const hud = (typeof document !== 'undefined') && document.getElementById('guided-mode-hud');
      return !!(hud && !hud.classList.contains('hidden') && hud.style.display !== 'none');
    } catch (e) {
      return false;
    }
  }

  stay() {
    this.isStationary = true;
    this.say("Staying here!");
  }

  follow() {
    this.isStationary = false;
    this.say("On my way!");
  }

  isTouching(kind, game) {
    if (kind === 'ice') {
      return this.touchingGroundType === 'ice';
    }

    // Scan active interactives list
    if (game && game.interactiveObjects) {
      for (const obj of game.interactiveObjects) {
        if (obj.type === kind && !obj.collected && Physics.isOverlapping(this, obj)) {
          return true;
        }
      }
    }

    if (kind === 'magnet' && game && game.interactiveObjects) {
      for (const obj of game.interactiveObjects) {
        if ((obj.type === 'pos_node' || obj.type === 'neg_node') && Physics.isOverlapping(this, obj)) {
          return true;
        }
      }
    }

    return false;
  }

  swap(game) {
    if (!game) return;

    // Switch active state inside the single player object!
    if (this.charType === 'star') {
      this.charType = 'hopper';
      this.w = 24;
      this.h = 32;
      this.mass = game.hopperMass !== undefined ? game.hopperMass : 2.5;
    } else {
      this.charType = 'star';
      this.w = 20;
      this.h = 32;
      this.mass = game.starMass !== undefined ? game.starMass : 1.0;
    }

    // Visual pop on swap
    const color = (this.charType === 'star') ? '#38bdf8' : '#f97316';
    Particles.spawnBurst(this.x + this.w / 2, this.y + this.h / 2, color, 15, 3, 4, 'glow');
    SFX.playSuccess();
  }

  update(keys, currentPlanet, game) {
    this.updateSpeech();

    if (game) {
      if (this.charType === 'star') {
        this.mass = game.starMass !== undefined ? game.starMass : 1.0;
      } else {
        this.mass = game.hopperMass !== undefined ? game.hopperMass : 2.5;
      }
    }
    // 1. Fetch parameters from Compiler variables, falling back to planet physics defaults
    const isCustomG = Compiler.env.gravity !== null;
    // Felt gravity = planet/override gravity minus the antigravity device.
    const baseGravity = (game && typeof game.getCurrentGravity === 'function')
      ? game.getCurrentGravity()
      : (isCustomG ? Compiler.env.gravity : currentPlanet.physics.gravity) - (Compiler.env.antigravity || 0);
    const isCustomF = Compiler.env.friction !== null;
    const baseFriction = isCustomF ? Compiler.env.friction : currentPlanet.physics.friction;
    const airResistance = currentPlanet.physics.airResistance ?? 0.99;

    // Top speed and jump launch are DERIVED from force / mass (F = m·a): a stronger
    // engine OR a lighter rover both go faster and jump higher.
    const engineForce = Compiler.env.engine ?? currentPlanet.physics.speed;
    const speedMultiplier = engineForce / this.mass;
    const jumpMultiplier = this.jumpPower / this.mass;

    // Apply scale changes dynamically
    this.w = 20 * this.scale;
    this.h = 32 * this.scale;

    // 2. Mass & gravity. Gravity is a free-fall acceleration — INDEPENDENT of mass: a
    // feather and a hammer fall together (Galileo's law). So BOTH suits feel the exact
    // same gravityForce. The heavy-vs-floaty contrast comes from mass resisting
    // acceleration instead — jumpMultiplier = jumpPower/mass and speedMultiplier =
    // engine/mass (computed above) — which is the honest F = m·a this game teaches.
    // (Previously gravity was scaled ×0.7 for Rover / ×1.3 for Hopper, which wrongly
    // taught that heavier things fall faster — the classic misconception. Removed.)
    let gravityForce = baseGravity;
    let horizontalFriction = baseFriction;

    // Check if this instance is the active player being controlled
    const isActive = (game && game.player === this);

    if (!isActive) {
      // Inactive Companion logic: follow active character or stay put
      if (this.isStationary) {
        // Just apply standard gravity/friction
        this.vx *= this.onGround ? horizontalFriction : airResistance;
        this.vy += gravityForce;
        if (this.vy > 12) this.vy = 12;
      } else {
        // Lerp behind active player
        const active = game.player;
        const targetX = active.x - 28 * (active.vx >= 0 ? 1 : -1);
        const targetY = active.y;
        this.x += (targetX - this.x) * 0.12;
        this.y += (targetY - this.y) * 0.12;
        this.vx = 0;
        this.vy = 0;
      }
      return;
    }

    // Robust key bindings mapping casing variations and older browser names
    const leftPressed = !!(keys['ArrowLeft'] || keys['arrowleft'] || keys['Left'] || keys['left']);
    const rightPressed = !!(keys['ArrowRight'] || keys['arrowright'] || keys['Right'] || keys['right']);
    const jumpPressed = !!(keys['w'] || keys['W'] || keys['ArrowUp'] || keys['arrowup'] || keys['Up'] || keys['up'] || keys[' ']);
    const downPressed = !!(keys['s'] || keys['S'] || keys['ArrowDown'] || keys['arrowdown'] || keys['Down'] || keys['down']);
    let appliedHorizontalDamping = false;
    this.isBraking = false;

    // 3. Horizontal movement inputs (Active character only)
    const walkAcceleration = 0.5;
    // Snappier turns: brake harder when input opposes motion (a quick skid) so direction
    // changes feel crisp — without changing top speed. Skid dust sells the stop.
    const reversing = (leftPressed && this.vx > 0.4) || (rightPressed && this.vx < -0.4);
    // Snappy grounded skid (3.2x); also a bit of air-steering (1.6x) so a cadet flung by a
    // knockback can fight back toward safety in low-gravity worlds.
    const accel = walkAcceleration * (reversing ? (this.onGround ? 3.2 : 1.6) : 1);
    if (reversing && this.onGround && Math.abs(this.vx) > 1.5 && Math.random() < 0.5) {
      Particles.spawn(this.x + this.w / 2, this.y + this.h, '#e2e8f0', 2, this.vx * 0.4, -0.6, 14, 'glow');
    }
    if (leftPressed) {
      this.facing = -1;
      this.vx -= accel;
      if (this.vx < -speedMultiplier) this.vx = -speedMultiplier;
      // Walking dust particles
      if (this.onGround && Math.random() < 0.15) {
        Particles.spawn(
          this.x + this.w / 2, this.y + this.h,
          'rgba(255, 255, 255, 0.4)', 1.5,
          0.5 + Math.random(), -Math.random() * 0.5,
          10
        );
      }
    } else if (rightPressed) {
      this.facing = 1;
      this.vx += accel;
      if (this.vx > speedMultiplier) this.vx = speedMultiplier;
      if (this.onGround && Math.random() < 0.15) {
        Particles.spawn(
          this.x + this.w / 2, this.y + this.h,
          'rgba(255, 255, 255, 0.4)', 1.5,
          -0.5 - Math.random(), -Math.random() * 0.5,
          10
        );
      }
    } else {
      // Apply friction/drag when keys are released
      if (Compiler.env.friction !== null && this.onGround) {
        const visualFriction = Compiler.env.friction; // 0 to 10
        horizontalFriction = 0.999 - (visualFriction / 10) * 0.299;
      }

      // Hopper spiked boots activation (holding S or Down arrow increases friction)
      if (this.charType === 'hopper' && (downPressed || this.spikes) && this.onGround) {
        horizontalFriction = 0.65; // High grip!
        this.isBraking = true;
        // Spark particles under boots
        if (Math.abs(this.vx) > 0.5) {
          Particles.spawn(
            this.x + this.w / 2, this.y + this.h,
            '#facc15', 2,
            -this.vx * 0.5 + (Math.random() - 0.5), -1 - Math.random(),
            12, 'glow'
          );
          if (Math.abs(this.vx) > 0.8) {
            this.gripBubbleTimer = (this.gripBubbleTimer || 0) + 1;
            if (this.gripBubbleTimer % 80 === 1 && typeof ComicBubbles !== 'undefined') {
              ComicBubbles.spawn(this.x + this.w / 2, this.y + this.h, SPEECH.pick("grip"), "rounded", "#bae6fd");
            }
          } else {
            this.gripBubbleTimer = 0;
          }
        } else {
          this.gripBubbleTimer = 0;
        }
      } else {
        this.gripBubbleTimer = 0;
      }

      this.vx *= this.onGround ? horizontalFriction : airResistance;
      appliedHorizontalDamping = true;
    }

    if (!this.onGround && !appliedHorizontalDamping) {
      this.vx *= airResistance;
    }

    // Coyote-time bookkeeping: refill the grace window every grounded frame, then count
    // it down once airborne. (this.onGround here is last frame's resolved value.)
    if (this.onGround) {
      this.coyoteFrames = 6;
    } else if (this.coyoteFrames > 0) {
      this.coyoteFrames--;
    }

    // 4. Jump movement inputs — fire while grounded OR within the coyote window just
    // after stepping off a ledge. The !isJumping guard keeps it from becoming a double jump.
    if (jumpPressed && (this.onGround || (this.coyoteFrames > 0 && !this.isJumping))) {
      this.vy = -jumpMultiplier;
      this.onGround = false;
      this.isJumping = true;
      this.coyoteFrames = 0;
      // Powered jumps burn fuel: a stronger jump and a heavier suit cost more; a lighter
      // suit is cheaper (mass reduction = less fuel). A jump near the planet baseline is
      // effectively free, so ordinary play is never taxed — only cranked-up settings are.
      const _jumpCost = Math.max(0, this.jumpPower - 14) * this.mass * 0.45;
      if (_jumpCost > 0) this.fuel = Math.max(0, this.fuel - _jumpCost);
      SFX.playJump();
      Particles.spawnBurst(this.x + this.w / 2, this.y + this.h, 'rgba(255,255,255,0.6)', 8, 1.5, 2);
      if (typeof ComicBubbles !== 'undefined') {
        ComicBubbles.spawn(this.x + this.w / 2, this.y + this.h, SPEECH.pick("jump"), "rounded", "#38bdf8");
      }

      // Guided tutorial hook
      if (typeof handleGuidedJumpHook === 'function') {
        handleGuidedJumpHook();
      }
    }

    // 5. Mid-air special maneuvers
    if (!this.onGround) {
      const isHoldJump = jumpPressed;

      if (this.charType === 'star') {
        // Star glide (reduces gravity pull by 60% if holding jump button while falling)
        if (isHoldJump && this.vy > 0) {
          gravityForce *= 0.4;
          // Spawn glide sparkles
          if (Math.random() < 0.25) {
            Particles.spawn(
              this.x + Math.random() * this.w, this.y + this.h,
              '#38bdf8', 1.5,
              (Math.random() - 0.5) * 0.5, 0.5,
              20, 'glow'
            );
          }
        }
      } else if (this.charType === 'hopper') {
        // Hopper rocket pack (holds space/jump button in mid-air to blast upward)
        if (isHoldJump && this.fuel > 0) {
          const tunedRocketPower = Number.isFinite(this.rocketPower) ? Math.max(0, this.rocketPower) : 40;
          const rocketAcceleration = tunedRocketPower / 35;
          const rocketRiseLimit = Math.max(speedMultiplier, tunedRocketPower / 12);
          this.vy -= rocketAcceleration;
          if (this.vy < -rocketRiseLimit) this.vy = -rocketRiseLimit;
          // Trade-off: a stronger rocket burns fuel proportionally faster, AND a heavier
          // suit is thirstier — dropping mass makes the rocket more fuel-efficient.
          this.fuel = Math.max(0, this.fuel - Math.max(0.5, 1.5 * (tunedRocketPower / 40) * (this.mass / 2.5)));
          // Rocket exhaust particles
          Particles.spawn(
            this.x + (Math.random() * 6) + 4, this.y + this.h,
            '#f97316', 2.5,
            (Math.random() - 0.5) * 0.8, 1.5 + Math.random() * 1.5,
            15, 'glow'
          );
          if (Math.random() < 0.22 && SFX.playRocket) SFX.playRocket(); // distinct rocket whoosh

          this.rocketBubbleTimer = (this.rocketBubbleTimer || 0) + 1;
          if (this.rocketBubbleTimer % 80 === 1 && typeof ComicBubbles !== 'undefined') {
            ComicBubbles.spawn(this.x + this.w / 2, this.y + this.h, SPEECH.pick("whoosh"), "jagged", "#f97316");
          }
        } else {
          this.rocketBubbleTimer = 0;
        }
      }
    } else {
      // On the ground the thruster refills FROM the finite tank (no free regen). Once the
      // tank is dry the thruster can't top up — find a fuel canister or reach the next level.
      const need = this.maxFuel - this.fuel;
      if (need > 0 && this.tank > 0) {
        const draw = Math.min(1.2, need, this.tank);
        this.fuel += draw;
        this.tank = Math.max(0, this.tank - draw);
      }
    }

    // Antigravity coil draws fuel while engaged (heavier suit = thirstier; lighter = cheaper).
    // When the tank runs dry, antigravity stops lifting (see Game.getCurrentGravity), so you
    // can't just float past everything for free.
    const _agUnits = (typeof Compiler !== 'undefined' && Compiler.env) ? Math.abs(Compiler.env.antigravity || 0) : 0;
    if (_agUnits > 0 && this.fuel > 0) {
      this.fuel = Math.max(0, this.fuel - _agUnits * this.mass * 1.0);
    }

    // 6. Electromagnet active (Hopper holds S / Down arrow in air)
    this.magnetActive = false;
    if (this.charType === 'hopper' && !this.onGround && downPressed) {
      this.magnetActive = true;
      this.magnetBubbleTimer = (this.magnetBubbleTimer || 0) + 1;
      if (this.magnetBubbleTimer % 80 === 1) {
        if (typeof ComicBubbles !== 'undefined') {
          ComicBubbles.spawn(this.x + this.w / 2, this.y, SPEECH.pick("zap"), "jagged", "#ec4899");
        }
        // Wire up the previously-dead playMagnet(): an electromagnetic hum on the same
        // cadence as the zap bubble so the magnet upgrade finally has a voice.
        if (typeof SFX !== 'undefined' && SFX.playMagnet) SFX.playMagnet();
      }
    } else {
      this.magnetBubbleTimer = 0;
    }

    // 6b. Downward thrust: hold Down in mid-air to push down — essential for steering
    // in very low gravity. Works for both suits. (Skipped on Mag-Net, where Down drives
    // the electromagnet instead.)
    const onMagnetWorld = game && game.currentPlanetIndex === 4;
    if (!this.onGround && downPressed && !onMagnetWorld) {
      this.vy += (this.charType === 'hopper') ? 0.55 : 0.4;
      // down-thrust dust
      if (Math.random() < 0.3) {
        Particles.spawn(this.x + this.w / 2, this.y, '#67e8f9', 1.5,
          (Math.random() - 0.5) * 0.6, -1 - Math.random(), 10, 'glow');
      }
    }

    // Apply gravity
    this.vy += gravityForce;
    if (this.vy > 12) this.vy = 12; // Terminal velocity

    // Spawn subtle energy-flow particles trailing the player
    if (game && Math.random() < 0.22) {
      const ke = 0.5 * this.mass * (this.vx * this.vx + this.vy * this.vy);
      const height = Math.max(0, 448 - this.y);
      const pe = this.mass * baseGravity * height * 0.04;
      const total = ke + pe;
      if (total > 0.05) {
        const isKe = Math.random() < (ke / total);
        const pColor = isKe ? '#4ade80' : '#38bdf8'; // Green for KE, Cyan for PE
        const pSize = 1.0 + Math.random() * 1.5;
        Particles.spawn(
          this.x + Math.random() * this.w,
          this.y + Math.random() * this.h,
          pColor,
          pSize,
          (Math.random() - 0.5) * 0.5,
          -0.5 - Math.random() * 0.8,
          20 + Math.random() * 20,
          'glow'
        );
      }
    }
  }

  // Thick dark comic ink outline around the CURRENT path. Temporarily kills the glow
  // shadow so the ink reads crisp, then restores it. This is the single trait that makes
  // the characters look hand-inked like a comic rather than soft neon blobs.
  inkStroke(ctx, s, width = 2.4) {
    const sb = ctx.shadowBlur;
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#0b1224';
    ctx.lineWidth = width * s;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.shadowBlur = sb;
  }

  draw(ctx, cameraX, game) {
    const isActive = (game && game.player === this);
    const cx = this.x + this.w / 2 - cameraX;
    const footY = this.y + this.h;
    const bob = Math.sin(Date.now() / 170 + this.x * 0.03) * (this.onGround ? 0.7 : 0.25);

    ctx.save();

    // Make inactive companion slightly translucent
    if (!isActive) {
      ctx.globalAlpha = 0.6;
    }

    // Blink while invulnerable after taking a hit (alpha flicker, ~every 80ms).
    if (this.invulnerableFrames > 0) {
      ctx.globalAlpha *= (Math.floor(Date.now() / 80) % 2 === 0) ? 0.3 : 0.75;
    }

    // Active pointer visual ring below active player's feet
    if (isActive) {
      const ringColor = (this.charType === 'star') ? '#38bdf8' : '#f97316';
      ctx.fillStyle = (this.charType === 'star') ? 'rgba(56, 189, 248, 0.16)' : 'rgba(249, 115, 22, 0.16)';
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 10;
      ctx.shadowColor = ringColor;
      ctx.beginPath();
      ctx.ellipse(cx, footY + 2, this.w * 0.78, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Rave mode colors
    let primaryColor = (this.charType === 'star') ? '#38bdf8' : '#f97316';
    let visorColor = (this.charType === 'star') ? '#0ea5e9' : '#facc15';
    if (Compiler.env.raveMode) {
      const hue = (Date.now() / 3) % 360;
      primaryColor = `hsl(${hue}, 90%, 60%)`;
      visorColor = `hsl(${(hue + 180) % 360}, 90%, 60%)`;
    }

    const x = this.x - cameraX;
    const y = this.y + bob;
    const s = this.scale;
    const midX = x + this.w / 2;

    ctx.shadowBlur = 9;
    ctx.shadowColor = primaryColor;

    if (this.charType === 'star') {
      // Rover body: a small explorer bot with wheels, antenna, and a friendly face.
      ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
      ctx.beginPath();
      ctx.ellipse(midX, y + this.h - 1, this.w * 0.72, 3.5 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#bae6fd';
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      ctx.moveTo(midX + 1 * s, y + 3 * s);
      ctx.lineTo(midX + 5 * s, y - 5 * s);
      ctx.stroke();
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(midX + 6 * s, y - 6 * s, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = primaryColor;
      ctx.beginPath();
      ctx.roundRect(x + 2 * s, y + 11 * s, this.w - 4 * s, 15 * s, 6 * s);
      ctx.fill();
      this.inkStroke(ctx, s);

      ctx.fillStyle = '#0e7490';
      ctx.beginPath();
      ctx.roundRect(x + 4 * s, y + 18 * s, this.w - 8 * s, 8 * s, 3 * s);
      ctx.fill();

      const dome = ctx.createLinearGradient(x, y, x, y + 15 * s);
      dome.addColorStop(0, 'rgba(224, 242, 254, 0.95)');
      dome.addColorStop(1, visorColor);
      ctx.fillStyle = dome;
      ctx.beginPath();
      ctx.roundRect(x + 3 * s, y + 2 * s, this.w - 6 * s, 13 * s, 7 * s);
      ctx.fill();
      this.inkStroke(ctx, s, 2);

      ctx.fillStyle = '#082f49';
      ctx.beginPath();
      ctx.arc(midX - 4 * s, y + 8 * s, 1.7 * s, 0, Math.PI * 2);
      ctx.arc(midX + 4 * s, y + 8 * s, 1.7 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(8, 47, 73, 0.72)';
      ctx.lineWidth = 1 * s;
      ctx.beginPath();
      ctx.arc(midX, y + 9.5 * s, 3.2 * s, 0.18 * Math.PI, 0.82 * Math.PI);
      ctx.stroke();

      ctx.shadowBlur = 0;
      for (const wheelX of [x + 5 * s, x + this.w - 5 * s]) {
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(wheelX, y + 27 * s, 4 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#67e8f9';
        ctx.lineWidth = 1.5 * s;
        ctx.stroke();
        ctx.fillStyle = '#e0f2fe';
        ctx.beginPath();
        ctx.arc(wheelX, y + 27 * s, 1.2 * s, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!this.onGround || Math.abs(this.vx) > 1.2) {
        ctx.globalAlpha *= 0.88;
        ctx.fillStyle = 'rgba(125, 211, 252, 0.28)';
        ctx.beginPath();
        ctx.ellipse(x - 1 * s, y + 18 * s, 5 * s, 2 * s, -0.4, 0, Math.PI * 2);
        ctx.ellipse(x + this.w + 1 * s, y + 18 * s, 5 * s, 2 * s, 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Hopper body: a compact rocket engineer suit with a visible pack and boots.
      const flameActive = !this.onGround && this.fuel < this.maxFuel;

      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.roundRect(x - 5 * s, y + 8 * s, 7 * s, 18 * s, 3 * s);
      ctx.fill();

      if (flameActive) {
        ctx.shadowBlur = 14;
        ctx.shadowColor = '#f97316';
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.moveTo(x - 2 * s, y + 25 * s);
        ctx.lineTo(x + 2 * s, y + 25 * s);
        ctx.lineTo(x, y + 36 * s + Math.sin(Date.now() / 45) * 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.moveTo(x - 1 * s, y + 25 * s);
        ctx.lineTo(x + 1.5 * s, y + 25 * s);
        ctx.lineTo(x + 0.5 * s, y + 31 * s);
        ctx.closePath();
        ctx.fill();
      }

      ctx.shadowBlur = 9;
      ctx.shadowColor = primaryColor;
      ctx.fillStyle = primaryColor;
      ctx.beginPath();
      ctx.roundRect(x + 2 * s, y + 8 * s, this.w - 4 * s, 19 * s, 7 * s);
      ctx.fill();
      this.inkStroke(ctx, s);

      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.roundRect(x + 4 * s, y + 2 * s, this.w - 8 * s, 12 * s, 6 * s);
      ctx.fill();
      this.inkStroke(ctx, s, 2);

      ctx.fillStyle = visorColor;
      ctx.beginPath();
      ctx.roundRect(x + 6 * s, y + 5 * s, this.w - 12 * s, 6 * s, 3 * s);
      ctx.fill();

      ctx.fillStyle = '#7c2d12';
      ctx.fillRect(x + 7 * s, y + 16 * s, this.w - 14 * s, 3 * s);
      ctx.fillStyle = '#fff7ed';
      ctx.beginPath();
      ctx.arc(midX, y + 21 * s, 2.2 * s, 0, Math.PI * 2);
      ctx.fill();

      // Spiked boots spikes
      if (this.isBraking) {
        ctx.fillStyle = '#e2e8f0';
        for (let i = 0; i < 3; i++) {
          const spikeX = x + 4 * s + i * 6 * s;
          ctx.beginPath();
          ctx.moveTo(spikeX, y + this.h - 1);
          ctx.lineTo(spikeX + 2.5 * s, y + this.h - 5 * s);
          ctx.lineTo(spikeX + 5 * s, y + this.h - 1);
          ctx.closePath();
          ctx.fill();
        }
      }

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(x + 3 * s, y + this.h - 5 * s, 7 * s, 4 * s, 2 * s);
      ctx.roundRect(x + this.w - 10 * s, y + this.h - 5 * s, 7 * s, 4 * s, 2 * s);
      ctx.fill();

      // Fuel gauge
      if (isActive) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.68)';
        ctx.beginPath();
        ctx.roundRect(x, y - 8, this.w, 4, 2);
        ctx.fill();
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.roundRect(x, y - 8, this.w * Math.max(0, Math.min(1, this.fuel / this.maxFuel)), 4, 2);
        ctx.fill();
      }
    }

    ctx.restore();

    // Draw retro 80s-arcade speech balloon (cream "message window" with a thick
    // character-colored frame, blocky pointer, and a typewriter character reveal).
    if (this.sayTimer > 0 && this.sayText && !this.shouldSuppressSpeech()) {
      const shownCount = Math.ceil(this.sayReveal);

      const accent = this.sayDialogue ? '#38bdf8' : ((this.charType === 'star') ? '#38bdf8' : '#f97316');
      const shout = this.sayShout;
      const dialogue = this.sayDialogue;
      const prefix = this.sayEmoji ? this.sayEmoji + ' ' : '';
      const full = prefix + this.sayText;
      const shown = prefix + this.sayText.slice(0, shownCount);

      ctx.save();
      ctx.font = shout ? "13px 'Press Start 2P', monospace" : (dialogue ? "600 11px 'Baloo 2', 'Outfit', sans-serif" : "bold 12px 'Outfit', sans-serif");
      // Word-wrap (single line for short shouts; multiple for dialogue).
      const maxW = dialogue ? 250 : 232;
      const padX = shout ? 12 : 10;
      const lines = [];
      let line = '';
      full.split(' ').forEach((w) => {
        const t = line ? line + ' ' + w : w;
        if (ctx.measureText(t).width > maxW - padX * 2 && line) { lines.push(line); line = w; }
        else line = t;
      });
      if (line) lines.push(line);
      const lineH = shout ? 17 : (dialogue ? 15 : 14);
      const bubbleW = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + padX * 2);
      const bubbleH = lines.length * lineH + (shout ? 11 : 9);
      const cx = this.x + this.w / 2 - cameraX;
      const canvasW = (game && game.canvas) ? game.canvas.width : 720;
      // Vertical placement first, so we can test whether the balloon overlaps the panel.
      let by = this.y - bubbleH - 16;
      let below = false;
      if (by < 4) { by = this.y + this.h + 12; below = true; } // flip under the cadet near the top edge
      // Keep the whole balloon on-screen AND clear of the top-left 🎯 Mission overlay.
      // The cadet spawns at the very-left edge, right under that panel, so a player-centred
      // box would both clip the margin and hide behind the panel. Push it right of the panel
      // (only while they actually overlap); the full text always lives in the Mission box,
      // and the tail still leans back toward the cadet.
      let leftBound = 6;
      try {
        const panel = (typeof document !== 'undefined') && document.getElementById('mission-bubble');
        const cv = game && game.canvas;
        if (panel && cv) {
          const pr = panel.getBoundingClientRect();
          const cr = cv.getBoundingClientRect();
          if (pr.width && cr.width) {
            const sx = cv.width / cr.width;          // canvas px per screen px
            const sy = cv.height / cr.height;
            const panelRight = (pr.right - cr.left) * sx;
            const panelTop = (pr.top - cr.top) * sy;
            const panelBottom = (pr.bottom - cr.top) * sy;
            const overlapsV = (by + bubbleH) > panelTop && by < panelBottom;
            if (overlapsV && panelRight > leftBound) leftBound = Math.min(panelRight + 10, canvasW - bubbleW - 6);
          }
        }
      } catch (e) { /* draw must never throw */ }
      const bx = Math.max(leftBound, Math.min(canvasW - bubbleW - 6, cx - bubbleW / 2));
      const centerX = bx + bubbleW / 2;
      const tailX = Math.max(bx + 12, Math.min(bx + bubbleW - 12, cx));

      ctx.shadowBlur = 0;
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.roundRect(bx - 3, by - 3, bubbleW + 6, bubbleH + 6, 6); ctx.fill();
      ctx.fillStyle = '#0b1022';
      ctx.beginPath(); ctx.roundRect(bx - 1.5, by - 1.5, bubbleW + 3, bubbleH + 3, 5); ctx.fill();
      ctx.fillStyle = '#fbf3da';
      ctx.beginPath(); ctx.roundRect(bx, by, bubbleW, bubbleH, 4); ctx.fill();

      // Blocky stepped pointer tail (points down to the cadet, or up if flipped below).
      ctx.fillStyle = accent;
      if (below) { ctx.fillRect(tailX - 6, by - 3, 12, 4); ctx.fillStyle = '#fbf3da'; ctx.fillRect(tailX - 4, by - 1, 8, 3); ctx.fillRect(tailX - 2, by - 4, 4, 3); }
      else { ctx.fillRect(tailX - 6, by + bubbleH - 1, 12, 4); ctx.fillStyle = '#fbf3da'; ctx.fillRect(tailX - 4, by + bubbleH - 1, 8, 3); ctx.fillRect(tailX - 2, by + bubbleH + 2, 4, 3); }

      // Text (dark navy ink on cream), revealed across the wrapped lines.
      ctx.fillStyle = '#15233e';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let used = 0;
      for (let i = 0; i < lines.length; i++) {
        const fl = lines[i];
        const remain = Math.max(0, shown.length - used);
        ctx.fillText(fl.slice(0, remain), centerX, by + (shout ? 6 : 5) + i * lineH + lineH / 2 - 2);
        used += fl.length + 1;
      }
      ctx.restore();
    }
  }
}

// Enemy Class
class Enemy {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type; // 'bug', 'spore', 'crusher', 'penguin', 'fly'
    this.w = 24;
    this.h = 24;
    this.vx = 1.2;
    this.vy = 0;
    this.dir = 1;
    this.scale = 1;

    // Hover variables
    this.baseY = y;
    this.time = Math.random() * 100;

    // Crusher states
    this.state = 'idle'; // 'idle', 'drop', 'ground', 'rise'
    this.crushTimer = 0;
  }

  update(tilemap, player) {
    // Override scales if scale command was run
    this.scale = Compiler.env.scale === 1 ? 1 : 0.5;
    this.w = 24 * this.scale;
    this.h = 24 * this.scale;

    let speedMult = 1.0;
    if (typeof Compiler !== 'undefined' && Compiler.env && Compiler.env.enemySpeed !== null && Compiler.env.enemySpeed !== undefined) {
      speedMult = Compiler.env.enemySpeed;
    }

    if (speedMult === 0) {
      return; // Freeze enemies completely!
    }

    // Adjust velocity magnitude based on speed override
    const targetSpeed = 1.2 * speedMult;
    if (this.vx !== 0) {
      this.vx = Math.sign(this.vx) * targetSpeed;
    }

    switch (this.type) {
      case 'bug': // Earth: Patrol walking
        this.vy += 0.5;
        this.x += this.vx * this.dir;

        // Horizontal wall collisions / ledge detection
        if (this.checkTileCollision(tilemap, this.x + (this.vx * this.dir), this.y)) {
          this.dir *= -1;
        }
        // Fall checks
        this.y += this.vy;
        if (this.checkTileCollision(tilemap, this.x, this.y)) {
          this.y = Math.floor(this.y / TILE_SIZE) * TILE_SIZE;
          this.vy = 0;
        }
        break;

      case 'spore': // Moon: Floating spore
        this.x += this.vx;
        this.y += this.vy;

        if (this.y < 32 || this.y > 400 || this.checkTileCollision(tilemap, this.x, this.y)) {
          this.vy *= -1;
        }
        if (this.checkTileCollision(tilemap, this.x + this.vx, this.y)) {
          this.vx *= -1;
        }
        break;

      case 'crusher': // Jupiter: Crusher
        this.time += 0.05;

        if (this.state === 'idle') {
          this.y = this.baseY + Math.sin(this.time) * 5;
          if (Math.abs(player.x - this.x) < 80 && player.y > this.y) {
            this.state = 'drop';
            this.vy = 0;
          }
        } else if (this.state === 'drop') {
          this.vy += 0.8;
          this.y += this.vy;
          if (this.checkTileCollision(tilemap, this.x, this.y)) {
            this.state = 'ground';
            this.vy = 0;
            this.crushTimer = 30;
            SFX.playStomp();
            Particles.spawnBurst(this.x + this.w / 2, this.y + this.h, '#ea580c', 8, 2, 2.5);
          }
        } else if (this.state === 'ground') {
          this.crushTimer--;
          if (this.crushTimer <= 0) {
            this.state = 'rise';
          }
        } else if (this.state === 'rise') {
          this.y -= 1;
          if (this.y <= this.baseY) {
            this.y = this.baseY;
            this.state = 'idle';
          }
        }
        break;

      case 'penguin': // Glacies: Slidey penguin
        this.x += this.vx * 2.5 * this.dir;
        if (this.checkTileCollision(tilemap, this.x + (this.vx * this.dir * 2), this.y)) {
          this.dir *= -1;
          Particles.spawnBurst(this.x + this.w / 2, this.y + this.h / 2, '#a78bfa', 6, 1.5, 2);
        }
        break;

      case 'fly': // Mag-Net: Flyer
        this.time += 0.08;
        this.x += this.vx * 0.8 * this.dir;
        this.y = this.baseY + Math.sin(this.time) * 20;

        if (this.checkTileCollision(tilemap, this.x + (this.vx * this.dir), this.y)) {
          this.dir *= -1;
        }
        break;
    }
  }

  checkTileCollision(tilemap, x, y) {
    const colLeft = Math.floor(x / TILE_SIZE);
    const colRight = Math.floor((x + this.w) / TILE_SIZE);
    const rowTop = Math.floor(y / TILE_SIZE);
    const rowBottom = Math.floor((y + this.h) / TILE_SIZE);

    if (colLeft < 0 || colRight >= tilemap[0].length || rowTop < 0 || rowBottom >= tilemap.length) return true;

    for (let r = rowTop; r <= rowBottom; r++) {
      for (let c = colLeft; c <= colRight; c++) {
        if (tilemap[r][c] === 1) return true;
      }
    }
    return false;
  }

  draw(ctx, cameraX) {
    ctx.save();
    ctx.shadowBlur = 6;

    const friendly = typeof Compiler !== 'undefined' && Compiler.env && Compiler.env.enemyFriendly;

    if (this.type === 'bug') {
      ctx.fillStyle = friendly ? '#4ade80' : '#ef4444';
      ctx.shadowColor = friendly ? '#4ade80' : '#ef4444';
      ctx.beginPath();
      ctx.arc(this.x + this.w / 2 - cameraX, this.y + this.h / 2, this.w / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.fillRect(this.x + this.w / 2 - 5 - cameraX, this.y + 6, 2, 3);
      ctx.fillRect(this.x + this.w / 2 + 3 - cameraX, this.y + 6, 2, 3);
      if (friendly) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(this.x + this.w / 2 - cameraX, this.y + this.h / 2 + 1, 3, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.stroke();
      }
    } else if (this.type === 'spore') {
      ctx.fillStyle = friendly ? '#4ade80' : '#38bdf8';
      ctx.shadowColor = friendly ? '#4ade80' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(this.x + this.w / 2 - cameraX, this.y + this.h / 2, this.w / 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'crusher') {
      ctx.fillStyle = friendly ? '#86efac' : '#64748b';
      ctx.shadowColor = friendly ? '#86efac' : '#64748b';
      ctx.fillRect(this.x - cameraX, this.y, this.w, this.h);
      ctx.fillStyle = friendly ? '#22c55e' : '#ea580c';
      ctx.fillRect(this.x + 4 - cameraX, this.y + 4, this.w - 8, 4);
    } else if (this.type === 'penguin') {
      ctx.fillStyle = friendly ? '#4ade80' : '#8b5cf6';
      ctx.shadowColor = friendly ? '#4ade80' : '#8b5cf6';
      ctx.beginPath();
      ctx.ellipse(this.x + this.w / 2 - cameraX, this.y + this.h / 2, this.w / 2, this.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = friendly ? '#a7f3d0' : '#f5d0fe';
      ctx.shadowColor = friendly ? '#4ade80' : '#ec4899';
      ctx.beginPath();
      ctx.arc(this.x + this.w / 2 - cameraX, this.y + this.h / 2, this.w / 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

// Interactive Objects
class InteractiveObject {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type; // 'coin', 'trampoline', 'spring', 'box', 'portal', 'pos_node', 'neg_node', 'boulder'
    this.w = 32;
    this.h = 32;

    if (this.type === 'coin') { this.w = 16; this.h = 16; this.y += 8; this.x += 8; }
    if (this.type === 'spring') { this.h = 16; this.y += 16; }
    if (this.type === 'trampoline') { this.h = 16; this.y += 16; }
    if (this.type === 'boulder') {
      this.w = 28;
      this.h = 28;
      this.vx = 0;
      this.vy = 0;
      this.mass = 2.0;
    }
    if (this.type === 'weapon') { this.w = 22; this.h = 18; this.y += 8; this.x += 5; }
    if (this.type === 'fuel') { this.w = 16; this.h = 20; this.y += 6; this.x += 8; }

    this.collected = false;
    this.bounceTimer = 0;
    this.angle = 0;
    this.rejectPulse = 0; // >0 right after bumping a still-locked gem (drives a red pulse)
  }

  update(game) {
    if (this.type === 'coin') {
      this.angle += 0.05;
    }
    if (this.bounceTimer > 0) {
      this.bounceTimer--;
    }
    if (this.rejectPulse > 0) {
      this.rejectPulse = Math.max(0, this.rejectPulse - 0.06);
    }

    if (this.type === 'boulder') {
      this.mass = (typeof Compiler !== 'undefined' && Compiler.env && Compiler.env.asteroidMass !== null && Compiler.env.asteroidMass !== undefined) ? Compiler.env.asteroidMass : 2.0;
      const currentPlanet = game ? game.currentPlanet : null;
      const baseGravity = game ? game.getCurrentGravity() : 0.6;
      const gravity = currentPlanet && currentPlanet.id === 5 ? 0.0 : baseGravity;
      const airResistance = currentPlanet && currentPlanet.physics ? currentPlanet.physics.airResistance : 0.99;
      
      this.vy += gravity;
      if (this.vy > 12) this.vy = 12;

      this.vx *= airResistance;
      this.vy *= airResistance;

      const tilemap = game ? game.getActiveMap() : null;
      if (tilemap && typeof Physics !== 'undefined') {
        this.x += this.vx;
        let collsX = Physics.getTileCollisions(this, tilemap);
        for (const t of collsX) {
          if (this.vx > 0) {
            this.x = t.c * TILE_SIZE - this.w;
            this.vx = -this.vx * 0.8;
          } else if (this.vx < 0) {
            this.x = (t.c + 1) * TILE_SIZE;
            this.vx = -this.vx * 0.8;
          }
        }

        this.y += this.vy;
        let collsY = Physics.getTileCollisions(this, tilemap);
        for (const t of collsY) {
          if (this.vy > 0) {
            this.y = t.r * TILE_SIZE - this.h;
            this.vy = -this.vy * 0.8;
          } else if (this.vy < 0) {
            this.y = (t.r + 1) * TILE_SIZE;
            this.vy = -this.vy * 0.8;
          }
        }
      } else {
        this.x += this.vx;
        this.y += this.vy;
      }
    }
  }

  draw(ctx, cameraX, game) {
    if (this.collected) return;

    ctx.save();
    ctx.shadowBlur = 6;

    if (this.type === 'coin') {
      const cx = this.x + this.w / 2 - cameraX;
      const cy = this.y + this.h / 2;
      const pulse = 1 + Math.sin(this.angle * 2) * 0.08;
      const gem = this.gem || (game && typeof game.getGemConfig === 'function' ? game.getGemConfig() : null);
      const color = gem ? gem.color : (this.requiredCollectible ? '#facc15' : '#fde68a');
      const glow = gem ? gem.glow : color;
      const locked = this.requiredCollectible
        && this.gemGate
        && game
        && typeof game.canCollectGem === 'function'
        && !game.canCollectGem(this);

      ctx.translate(cx, cy);
      // Add a quick shake on top of the idle spin when the gem was just bumped while locked.
      const wobble = this.rejectPulse > 0 ? Math.sin(this.rejectPulse * 24) * this.rejectPulse * 0.4 : 0;
      ctx.rotate(Math.sin(this.angle) * 0.24 + wobble);
      ctx.scale(pulse, pulse);
      ctx.globalAlpha = locked ? 0.42 : 1;
      // Halo from a cached sprite instead of per-frame shadowBlur (same look,
      // softer falloff, ~free). Falls back to shadowBlur without a canvas cache.
      ctx.shadowBlur = 0;
      if (typeof RenderCache !== 'undefined') {
        const halo = RenderCache.glowSprite(color, 12);
        if (halo) {
          ctx.globalAlpha = (locked ? 0.42 : 1) * 0.85;
          ctx.drawImage(halo, -19, -19, 38, 38);
          ctx.globalAlpha = locked ? 0.42 : 1;
        } else {
          ctx.shadowColor = color;
          ctx.shadowBlur = 14;
        }
      } else {
        ctx.shadowColor = color;
        ctx.shadowBlur = 14;
      }
      ctx.fillStyle = color;
      drawGemShape(ctx, 0, 0, 9, 12);
      ctx.fill();

      // Thick dark comic ink rim first, then the white sheen highlight on top — gives the
      // gem a crisp inked facet edge that reads against any planet background.
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#0b1224';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.moveTo(-5, -2);
      ctx.lineTo(0, 6);
      ctx.lineTo(5, -2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.moveTo(-3.5, -4);
      ctx.lineTo(-1, -6.5);
      ctx.lineTo(1.5, -4);
      ctx.closePath();
      ctx.fill();
      ctx.shadowColor = glow;

      if (locked) {
        ctx.globalAlpha = 0.95;
        ctx.shadowBlur = 0;
        // Expanding red "nope" ring when freshly bumped — unmissable for visual learners.
        if (this.rejectPulse > 0) {
          ctx.save();
          ctx.globalAlpha = Math.min(1, this.rejectPulse);
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2 + this.rejectPulse * 2;
          ctx.beginPath();
          ctx.arc(0, 0, 10 + (1 - this.rejectPulse) * 9, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.beginPath();
        ctx.arc(0, -2, 4, Math.PI, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.roundRect(-5, -1, 10, 8, 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
        ctx.beginPath();
        ctx.arc(0, 3, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (this.type === 'trampoline' || this.type === 'spring') {
      const compression = this.bounceTimer > 0 ? 5 : 0;
      const x = this.x - cameraX;
      const y = this.y + compression;

      ctx.shadowColor = '#fb7185';
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.roundRect(x, this.y + this.h - 4, this.w, 4, 2);
      ctx.fill();

      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x + 8, this.y + this.h - 4);
      ctx.lineTo(x + 14, y + 8);
      ctx.lineTo(x + 20, this.y + this.h - 4);
      ctx.lineTo(x + 26, y + 8);
      ctx.stroke();

      ctx.fillStyle = '#fb7185';
      ctx.beginPath();
      ctx.roundRect(x + 2, y, this.w - 4, 7, 4);
      ctx.fill();
    } else if (this.type === 'box') {
      const x = this.x - cameraX;
      ctx.fillStyle = '#d97706';
      ctx.shadowColor = '#f59e0b';
      ctx.beginPath();
      ctx.roundRect(x, this.y, this.w, this.h, 4);
      ctx.fill();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 3, this.y + 3, this.w - 6, this.h - 6);
      ctx.beginPath();
      ctx.moveTo(x + 4, this.y + 4);
      ctx.lineTo(x + this.w - 4, this.y + this.h - 4);
      ctx.moveTo(x + this.w - 4, this.y + 4);
      ctx.lineTo(x + 4, this.y + this.h - 4);
      ctx.stroke();
    } else if (this.type === 'pos_node') {
      const x = this.x - cameraX;
      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = '#ef4444';
      ctx.beginPath();
      ctx.roundRect(x, this.y, this.w, this.h, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('+', this.x + this.w / 2 - cameraX, this.y + 24);
    } else if (this.type === 'neg_node') {
      const x = this.x - cameraX;
      ctx.fillStyle = '#3b82f6';
      ctx.shadowColor = '#3b82f6';
      ctx.beginPath();
      ctx.roundRect(x, this.y, this.w, this.h, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('-', this.x + this.w / 2 - cameraX, this.y + 22);
    } else if (this.type === 'portal') {
      const status = game && typeof game.getLevelObjectiveStatus === 'function' ? game.getLevelObjectiveStatus() : { readyForPortal: true };
      const ready = status.readyForPortal;
      const cx = this.x + this.w / 2 - cameraX;
      const cy = this.y + this.h / 2;
      const pulse = 1 + Math.sin(Date.now() / 180) * 0.08;
      const coreColor = ready ? '#4ade80' : '#94a3b8';

      ctx.globalAlpha = ready ? 1 : 0.72;
      ctx.strokeStyle = ready ? '#bbf7d0' : '#cbd5e1';
      ctx.fillStyle = ready ? 'rgba(34, 197, 94, 0.22)' : 'rgba(100, 116, 139, 0.18)';
      ctx.shadowColor = coreColor;
      ctx.shadowBlur = ready ? 16 : 8;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(cx, cy, this.w / 2 * pulse, this.h / 2 * pulse, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.ellipse(cx, cy, this.w / 2 + 5, this.h / 2 + 5, 0, 0, Math.PI * 2);
      ctx.stroke();

      if (!ready) {
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🔒', cx, cy + 5);
      }
    } else if (this.type === 'boulder') {
      const x = this.x - cameraX;
      ctx.save();
      ctx.strokeStyle = '#0b1224';
      ctx.lineWidth = 3;
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      const cx = x + this.w / 2;
      const cy = this.y + this.h / 2;
      const r = this.w / 2;
      ctx.moveTo(cx + r, cy);
      ctx.lineTo(cx + r * 0.7, cy + r * 0.7);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r * 0.7, cy + r * 0.7);
      ctx.lineTo(cx - r, cy);
      ctx.lineTo(cx - r * 0.7, cy - r * 0.7);
      ctx.lineTo(cx, cy - r);
      ctx.lineTo(cx + r * 0.7, cy - r * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx - 5, cy - 4, 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + 6, cy + 5, 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx - 3, cy + 6, 1.5, 0, Math.PI * 2);
      ctx.stroke();

      const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      if (speed > 0.5) {
        ctx.strokeStyle = 'rgba(251, 146, 60, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x - 2, this.y - 2, this.w + 4, this.h + 4);
      }
      ctx.restore();
    } else if (this.type === 'weapon') {
      // A glowing blaster pickup — collect it to unlock shooting (press F).
      const x = this.x - cameraX;
      const cx = x + this.w / 2;
      const bob = Math.sin(Date.now() / 220 + this.x * 0.05) * 2;
      const cy = this.y + this.h / 2 + bob;
      ctx.save();
      ctx.shadowBlur = 12; ctx.shadowColor = '#facc15';
      ctx.fillStyle = '#facc15'; ctx.strokeStyle = '#0b1224'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.roundRect(cx - 9, cy - 3, 16, 6, 2); ctx.fill(); ctx.stroke();   // barrel/body
      ctx.beginPath(); ctx.roundRect(cx - 6, cy + 1, 5, 7, 1.5); ctx.fill(); ctx.stroke();   // grip
      ctx.fillStyle = '#fde68a';
      ctx.beginPath(); ctx.arc(cx + 8, cy, 2.4, 0, Math.PI * 2); ctx.fill();                 // muzzle spark
      ctx.restore();
    } else if (this.type === 'fuel') {
      // A fuel canister — collect it to refill the tank.
      const x = this.x - cameraX;
      const cx = x + this.w / 2;
      const bob = Math.sin(Date.now() / 240 + this.x * 0.05) * 2;
      const top = this.y + bob;
      ctx.save();
      ctx.shadowBlur = 12; ctx.shadowColor = '#f97316';
      ctx.fillStyle = '#ea580c'; ctx.strokeStyle = '#0b1224'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.roundRect(cx - this.w / 2 + 1, top + 3, this.w - 2, this.h - 5, 3); ctx.fill(); ctx.stroke(); // body
      ctx.fillStyle = '#fb923c';
      ctx.beginPath(); ctx.roundRect(cx - 3, top, 6, 4, 1.5); ctx.fill(); ctx.stroke();        // cap
      ctx.fillStyle = '#fff7ed'; ctx.font = "bold 9px 'Outfit', sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('⛽', cx, top + this.h / 2 + 1);                                              // fuel glyph
      ctx.restore();
    }

    ctx.restore();
  }
}

function drawGemShape(ctx, x, y, halfWidth, height) {
  const topY = y - height / 2;
  const midY = y - height * 0.15;
  const bottomY = y + height / 2;

  ctx.beginPath();
  ctx.moveTo(x, topY);
  ctx.lineTo(x + halfWidth, midY);
  ctx.lineTo(x + halfWidth * 0.55, bottomY);
  ctx.lineTo(x - halfWidth * 0.55, bottomY);
  ctx.lineTo(x - halfWidth, midY);
  ctx.closePath();
}

// Helper to pull active styles in context
function var_css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

class NPC extends InteractiveObject {
  constructor(config) {
    super(config.x, config.y, config.type);
    this.id = config.id;
    this.name = config.name;
    this.profession = config.profession;
    this.color = config.color;
    this.w = 28;
    this.h = 36;
    this.proximity = false; // Player is nearby
    
    // Set dialogue lists
    if (this.id === 'geary') {
      this.dialogue = [
        "Hey Cadet! I'm Geary, the Machinist. My forge needs Emeralds to craft heavy engines.",
        "With enough Emeralds, I can push your engine speed and jump springs beyond safety caps!",
        "Let's make these rovers move like rockets!"
      ];
      this.trades = [
        { id: 'engine_1', cost: { type: 'emerald', amount: 1 }, desc: 'Reinforce Engine: Max +3', reward: { type: 'cap', key: 'engine', amount: 3 } },
        { id: 'engine_2', cost: { type: 'emerald', amount: 3 }, desc: 'Overclock Engine: Max +5', reward: { type: 'cap', key: 'engine', amount: 5 } }
      ];
    } else if (this.id === 'bitbyte') {
      this.dialogue = [
        "01001000 01001001! I am Bit-Byte. I parse logic gates and syntax parameters.",
        "Bring me Moon Quartz, and I'll tune your jump-loop logic so your springs launch higher.",
        "Code is the poetry of physics, Cadet."
      ];
      // (repeat/if are already free + tutorial-taught, so these now grant a real jump-cap boost
      // — letting your repeat-loop spring stacks reach higher — instead of selling free commands.)
      this.trades = [
        { id: 'code_1', cost: { type: 'quartz', amount: 1 }, desc: 'Tune Jump Logic: Max +2', reward: { type: 'cap', key: 'jump', amount: 2 } },
        { id: 'code_2', cost: { type: 'quartz', amount: 2 }, desc: 'Optimize Jump Loops: Max +4', reward: { type: 'cap', key: 'jump', amount: 4 } }
      ];
    } else if (this.id === 'horizon') {
      this.dialogue = [
        "Greetings, stargazer. I'm Horizon. I map the stars and plot trajectories.",
        "Trade me Amber Storm from Jupiter, and I will reveal coordinates to secret sectors.",
        "The universe is expanding, and so should our map."
      ];
      this.trades = [
        { id: 'map_1', cost: { type: 'amber', amount: 1 }, desc: 'Unlock Asteroid Forge map coordinates', reward: { type: 'planet', key: 5 } }
      ];
    } else if (this.id === 'tesla') {
      this.dialogue = [
        "BZZZT! Static energy everywhere! I'm Tesla, the Magnetist.",
        "Magenta Flux from the nebula can help me charge magnetic repulsor boots.",
        "Opposites attract, Cadet. Let's charge up!"
      ];
      this.trades = [
        { id: 'magnet_1', cost: { type: 'flux', amount: 1 }, desc: 'Craft Magnet Coils (Antigrav +2)', reward: { type: 'cap', key: 'antigravity', amount: 2 } }
      ];
    } else {
      this.dialogue = ["Greetings Cadet!"];
      this.trades = [];
    }
  }

  update(game) {
    if (!game || !game.player) return;
    // Track distance to player
    const dx = (this.x + this.w / 2) - (game.player.x + game.player.w / 2);
    const dy = (this.y + this.h / 2) - (game.player.y + game.player.h / 2);
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    const wasProx = this.proximity;
    this.proximity = (dist < 48);

    if (this.proximity && !wasProx) {
      // Just walked up: spawn a greeting balloon
      if (typeof ComicBubbles !== 'undefined') {
        ComicBubbles.spawn(this.x + this.w / 2, this.y - 6, `Hrrr! I'm the ${this.profession}.`, "rounded", this.color, -0.4, { maxLife: 100 });
      }
    }
  }

  draw(ctx, cameraX, game) {
    const cx = this.x - cameraX;
    const cy = this.y;

    ctx.save();
    
    // Glowing aura if player is nearby
    if (this.proximity) {
      ctx.shadowBlur = 15;
      ctx.shadowColor = this.color;
    } else {
      ctx.shadowBlur = 4;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
    }

    // Robot outer casing
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(cx, cy + 8, this.w, this.h - 8, 6);
    ctx.fill();
    ctx.stroke();

    // Robot glowing screen/face
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(cx + 4, cy + 12, this.w - 8, 14, 4);
    ctx.fill();
    ctx.stroke();

    // Glowing eyes (screen content)
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(cx + 9, cy + 19, 2.5, 0, Math.PI * 2);
    ctx.arc(cx + this.w - 9, cy + 19, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Robot core light/heart
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(cx + this.w / 2, cy + 29, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Antenna
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + this.w / 2, cy + 8);
    ctx.lineTo(cx + this.w / 2, cy);
    ctx.stroke();

    // Antenna glowing bulb
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(cx + this.w / 2, cy, 3, 0, Math.PI * 2);
    ctx.fill();

    // Draw floating prompt if proximity is active
    if (this.proximity && game && game.activeNPC === this) {
      ctx.restore();
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.font = "bold 9px 'Share Tech Mono', sans-serif";
      ctx.textAlign = 'center';
      // Pulse animation
      const bob = Math.sin(Date.now() / 150) * 1.5;
      ctx.fillText('[PRESS E TO TRADE]', cx + this.w / 2, cy - 14 + bob);
    }

    ctx.restore();
  }
}
