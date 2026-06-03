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
    
    // Character dimensions
    this.w = 20;
    this.h = 32;
    this.scale = 1.0;
    this.mass = 1.0;
    this.jumpPower = 15;
    
    // Hopper specifics
    this.fuel = 100;
    this.maxFuel = 100;
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

    // Split/Co-op coordinates control
    this.isStationary = false;
    this.facing = 1;
  }

  // Retro 80s-style speech balloon. opts: { emoji, shout, timer }
  say(text, opts) {
    opts = opts || {};
    this.sayText = text;
    this.sayEmoji = opts.emoji || "";
    this.sayShout = !!opts.shout;       // big pixel-font arcade shout (e.g. "GET!")
    this.sayTimer = opts.timer || 150;  // ~2.5s at 60fps
    this.sayReveal = 0;                 // chars revealed so far (typewriter effect)
    this.sayPrevLen = 0;
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

    // 2. Character-specific Mass/Gravity adjustments
    let gravityForce = baseGravity;
    let horizontalFriction = baseFriction;

    // Gravity is a free-fall acceleration — independent of mass (a feather and a
    // hammer fall together). Mass instead resists acceleration (speed/jump above).
    if (this.charType === 'star') {
      gravityForce = baseGravity * 0.7;
    } else {
      gravityForce = baseGravity * 1.3;
    }

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
    if (leftPressed) {
      this.facing = -1;
      this.vx -= walkAcceleration;
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
      this.vx += walkAcceleration;
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
        }
      }

      this.vx *= this.onGround ? horizontalFriction : airResistance;
      appliedHorizontalDamping = true;
    }

    if (!this.onGround && !appliedHorizontalDamping) {
      this.vx *= airResistance;
    }

    // 4. Jump movement inputs
    if (jumpPressed && this.onGround) {
      this.vy = -jumpMultiplier;
      this.onGround = false;
      this.isJumping = true;
      SFX.playJump();
      Particles.spawnBurst(this.x + this.w / 2, this.y + this.h, 'rgba(255,255,255,0.6)', 8, 1.5, 2);
      
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
          this.fuel -= 1.5;
          // Rocket exhaust particles
          Particles.spawn(
            this.x + (Math.random() * 6) + 4, this.y + this.h, 
            '#f97316', 2.5, 
            (Math.random() - 0.5) * 0.8, 1.5 + Math.random() * 1.5, 
            15, 'glow'
          );
          if (Math.random() < 0.2) SFX.playJump(); // soft thrust hum
        }
      }
    } else {
      // Recharge fuel on ground
      this.fuel = Math.min(this.fuel + 2, this.maxFuel);
    }

    // 6. Electromagnet active (Hopper holds S / Down arrow in air)
    this.magnetActive = false;
    if (this.charType === 'hopper' && !this.onGround && downPressed) {
      this.magnetActive = true;
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

      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.roundRect(x + 4 * s, y + 2 * s, this.w - 8 * s, 12 * s, 6 * s);
      ctx.fill();

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
        ctx.roundRect(x, y - 8, this.w * (this.fuel / this.maxFuel), 4, 2);
        ctx.fill();
      }
    }

    ctx.restore();

    // Draw retro 80s-arcade speech balloon (cream "message window" with a thick
    // character-colored frame, blocky pointer, and a typewriter character reveal).
    if (this.sayTimer > 0 && this.sayText) {
      this.sayTimer--;
      if (this.sayReveal === undefined) this.sayReveal = this.sayText.length;
      this.sayReveal = Math.min(this.sayText.length, (this.sayReveal || 0) + 0.55);
      const shownCount = Math.ceil(this.sayReveal);
      // Soft "blip" as each new glyph appears, classic JRPG textbox feel.
      if (shownCount > (this.sayPrevLen || 0) && typeof SFX !== 'undefined' && SFX.playType) {
        if (Math.random() < 0.6) SFX.playType();
      }
      this.sayPrevLen = shownCount;

      const accent = (this.charType === 'star') ? '#38bdf8' : '#f97316';
      const shout = this.sayShout;
      const prefix = this.sayEmoji ? this.sayEmoji + ' ' : '';
      const fullLabel = prefix + this.sayText;
      const shownLabel = prefix + this.sayText.slice(0, shownCount);

      ctx.save();
      ctx.font = shout ? "13px 'Press Start 2P', monospace" : "bold 12px 'Outfit', sans-serif";
      // Measure with the FULL text so the window keeps a steady size while typing.
      const textWidth = ctx.measureText(fullLabel).width;
      const padX = shout ? 12 : 10;
      const bubbleW = Math.min(232, textWidth + padX * 2);
      const bubbleH = shout ? 28 : 23;
      const cx = this.x + this.w / 2 - cameraX;
      const bx = cx - bubbleW / 2;
      const by = this.y - bubbleH - 16;

      ctx.shadowBlur = 0;
      // 1. Outer character-colored frame (the retro "window" border).
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.roundRect(bx - 3, by - 3, bubbleW + 6, bubbleH + 6, 6); ctx.fill();
      // 2. Thin dark keyline for that crisp pixel-window edge.
      ctx.fillStyle = '#0b1022';
      ctx.beginPath(); ctx.roundRect(bx - 1.5, by - 1.5, bubbleW + 3, bubbleH + 3, 5); ctx.fill();
      // 3. Cream parchment panel.
      ctx.fillStyle = '#fbf3da';
      ctx.beginPath(); ctx.roundRect(bx, by, bubbleW, bubbleH, 4); ctx.fill();

      // 4. Blocky stepped pointer (pixel tail) under the window.
      ctx.fillStyle = accent;
      ctx.fillRect(cx - 6, by + bubbleH - 1, 12, 4);
      ctx.fillStyle = '#fbf3da';
      ctx.fillRect(cx - 4, by + bubbleH - 1, 8, 3);
      ctx.fillRect(cx - 2, by + bubbleH + 2, 4, 3);

      // 5. Text (dark navy ink on cream).
      ctx.fillStyle = '#15233e';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(shownLabel, cx, by + bubbleH / 2 + 1);
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
            Particles.spawnBurst(this.x + this.w/2, this.y + this.h, '#ea580c', 8, 2, 2.5);
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
          Particles.spawnBurst(this.x + this.w/2, this.y + this.h/2, '#a78bfa', 6, 1.5, 2);
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
    
    if (this.type === 'bug') {
      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = '#ef4444';
      ctx.beginPath();
      ctx.arc(this.x + this.w/2 - cameraX, this.y + this.h/2, this.w/2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.fillRect(this.x + this.w/2 - 5 - cameraX, this.y + 6, 2, 3);
      ctx.fillRect(this.x + this.w/2 + 3 - cameraX, this.y + 6, 2, 3);
    } else if (this.type === 'spore') {
      ctx.fillStyle = '#38bdf8';
      ctx.shadowColor = '#38bdf8';
      ctx.beginPath();
      ctx.arc(this.x + this.w/2 - cameraX, this.y + this.h/2, this.w/2, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'crusher') {
      ctx.fillStyle = '#64748b';
      ctx.shadowColor = '#64748b';
      ctx.fillRect(this.x - cameraX, this.y, this.w, this.h);
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(this.x + 4 - cameraX, this.y + 4, this.w - 8, 4);
    } else if (this.type === 'penguin') {
      ctx.fillStyle = '#8b5cf6';
      ctx.shadowColor = '#8b5cf6';
      ctx.beginPath();
      ctx.ellipse(this.x + this.w/2 - cameraX, this.y + this.h/2, this.w/2, this.h/2, 0, 0, Math.PI*2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#f5d0fe';
      ctx.shadowColor = '#ec4899';
      ctx.beginPath();
      ctx.arc(this.x + this.w/2 - cameraX, this.y + this.h/2, this.w/3, 0, Math.PI*2);
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
    this.type = type; // 'coin', 'trampoline', 'spring', 'box', 'portal', 'pos_node', 'neg_node'
    this.w = 32;
    this.h = 32;

    if (this.type === 'coin') { this.w = 16; this.h = 16; this.y += 8; this.x += 8; }
    if (this.type === 'spring') { this.h = 16; this.y += 16; }
    if (this.type === 'trampoline') { this.h = 16; this.y += 16; }

    this.collected = false;
    this.bounceTimer = 0;
    this.angle = 0;
  }

  update() {
    if (this.type === 'coin') {
      this.angle += 0.05;
    }
    if (this.bounceTimer > 0) {
      this.bounceTimer--;
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
      ctx.rotate(Math.sin(this.angle) * 0.24);
      ctx.scale(pulse, pulse);
      ctx.globalAlpha = locked ? 0.42 : 1;
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      ctx.fillStyle = color;
      drawGemShape(ctx, 0, 0, 9, 12);
      ctx.fill();

      ctx.shadowBlur = 0;
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
      ctx.fillText('+', this.x + this.w/2 - cameraX, this.y + 24);
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
      ctx.fillText('-', this.x + this.w/2 - cameraX, this.y + 22);
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
