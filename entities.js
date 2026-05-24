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
  }

  say(text) {
    this.sayText = text;
    this.sayTimer = 150; // 2.5 seconds (at 60fps)
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
    const baseGravity = isCustomG ? Compiler.env.gravity : currentPlanet.physics.gravity;
    const isCustomF = Compiler.env.friction !== null;
    const baseFriction = isCustomF ? Compiler.env.friction : currentPlanet.physics.friction;
    const airResistance = currentPlanet.physics.airResistance ?? 0.99;
    
    const speedMultiplier = Compiler.env.speed ?? currentPlanet.physics.speed;
    const jumpMultiplier = this.jumpPower;

    // Apply scale changes dynamically
    this.w = 20 * this.scale;
    this.h = 32 * this.scale;

    // 2. Character-specific Mass/Gravity adjustments
    let gravityForce = baseGravity;
    let horizontalFriction = baseFriction;

    if (this.charType === 'star') {
      gravityForce = baseGravity * 0.7 * this.mass;
    } else {
      gravityForce = baseGravity * 1.3 * this.mass;
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
          this.vy -= (this.rocketPower || 0.45);
          if (this.vy < -speedMultiplier) this.vy = -speedMultiplier;
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

    // Apply gravity
    this.vy += gravityForce;
    if (this.vy > 12) this.vy = 12; // Terminal velocity
  }

  draw(ctx, cameraX, game) {
    const isActive = (game && game.player === this);
    
    ctx.save();
    
    // Draw character specific glow
    ctx.shadowBlur = 8;
    ctx.shadowColor = (this.charType === 'star') ? var_css('--neon-cyan') : var_css('--neon-orange');

    // Make inactive companion slightly translucent
    if (!isActive) {
      ctx.globalAlpha = 0.6;
      ctx.shadowBlur = 3;
    }

    // Active pointer visual ring below active player's feet
    if (isActive) {
      ctx.strokeStyle = (this.charType === 'star') ? '#38bdf8' : '#f97316';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(this.x + this.w/2 - cameraX, this.y + this.h, this.w * 0.7, 4, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Rave mode colors
    let primaryColor = (this.charType === 'star') ? '#38bdf8' : '#f97316';
    let visorColor = (this.charType === 'star') ? '#0ea5e9' : '#facc15';
    if (Compiler.env.raveMode) {
      const hue = (Date.now() / 3) % 360;
      primaryColor = `hsl(${hue}, 90%, 60%)`;
      visorColor = `hsl(${(hue + 180) % 360}, 90%, 60%)`;
    }

    // Draw Spacesuit Body
    ctx.fillStyle = primaryColor;
    ctx.beginPath();
    ctx.roundRect(this.x - cameraX, this.y, this.w, this.h, 6 * this.scale);
    ctx.fill();

    // Helmet Visor
    ctx.fillStyle = visorColor;
    ctx.beginPath();
    ctx.roundRect(this.x + (3 * this.scale) - cameraX, this.y + (4 * this.scale), this.w - (6 * this.scale), 10 * this.scale, 4 * this.scale);
    ctx.fill();

    // Visor shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(this.x + (6 * this.scale) - cameraX, this.y + (6 * this.scale), 2 * this.scale, 0, Math.PI * 2);
    ctx.fill();

    // Star Symbol
    if (this.charType === 'star') {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(this.x + this.w/2 - cameraX, this.y + (20 * this.scale), 2.5 * this.scale, 0, Math.PI*2);
      ctx.fill();
    } else {
      // Rocket Thruster Pack
      ctx.fillStyle = '#475569';
      ctx.fillRect(this.x - (4 * this.scale) - cameraX, this.y + (8 * this.scale), 4 * this.scale, 16 * this.scale);
      
      // Spiked boots spikes
      if (this.isBraking) {
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(this.x - cameraX, this.y + this.h - 2, this.w, 3);
      }
      
      // Fuel gauge
      if (isActive) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x - cameraX, this.y - 8, this.w, 3);
        ctx.fillStyle = '#f97316';
        ctx.fillRect(this.x - cameraX, this.y - 8, this.w * (this.fuel / this.maxFuel), 3);
      }
    }

    ctx.restore();

    // Draw speech bubble if active
    if (this.sayTimer > 0 && this.sayText) {
      this.sayTimer--;
      
      ctx.save();
      ctx.shadowBlur = 4;
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'; // Dark glass
      ctx.strokeStyle = (this.charType === 'star') ? '#38bdf8' : '#f97316';
      ctx.lineWidth = 1.5;
      
      const text = this.sayText;
      ctx.font = '11px sans-serif';
      const textWidth = ctx.measureText(text).width;
      const bubbleW = textWidth + 16;
      const bubbleH = 20;
      const bx = this.x + this.w/2 - bubbleW/2 - cameraX;
      const by = this.y - bubbleH - 12;
      
      // Draw rounded bubble rect
      ctx.beginPath();
      ctx.roundRect(bx, by, bubbleW, bubbleH, 4);
      ctx.fill();
      ctx.stroke();
      
      // Draw pointing bubble triangle
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.moveTo(this.x + this.w/2 - cameraX - 4, by + bubbleH);
      ctx.lineTo(this.x + this.w/2 - cameraX + 4, by + bubbleH);
      ctx.lineTo(this.x + this.w/2 - cameraX, by + bubbleH + 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      // Draw text
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(text, this.x + this.w/2 - cameraX, by + 14);
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

  draw(ctx, cameraX) {
    if (this.collected) return;
    
    ctx.save();
    ctx.shadowBlur = 6;

    if (this.type === 'coin') {
      ctx.fillStyle = '#facc15';
      ctx.shadowColor = '#facc15';
      ctx.beginPath();
      ctx.ellipse(this.x + this.w/2 - cameraX, this.y + this.h/2, this.w/2 * Math.abs(Math.sin(this.angle)), this.h/2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'trampoline' || this.type === 'spring') {
      ctx.fillStyle = '#64748b';
      ctx.shadowColor = '#475569';
      ctx.fillRect(this.x - cameraX, this.y + this.h - 4, this.w, 4); // base
      
      ctx.fillStyle = '#f87171';
      if (this.bounceTimer > 0) {
        ctx.fillRect(this.x + 2 - cameraX, this.y + this.h - 8, this.w - 4, 4);
      } else {
        ctx.fillRect(this.x + 2 - cameraX, this.y, this.w - 4, 6);
      }
    } else if (this.type === 'box') {
      ctx.fillStyle = '#ea580c';
      ctx.shadowColor = '#c2410c';
      ctx.fillRect(this.x - cameraX, this.y, this.w, this.h);
      ctx.strokeStyle = '#f97316';
      ctx.strokeRect(this.x + 2 - cameraX, this.y + 2, this.w - 4, this.h - 4);
    } else if (this.type === 'pos_node') {
      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = '#ef4444';
      ctx.fillRect(this.x - cameraX, this.y, this.w, this.h);
      ctx.fillStyle = '#ffffff';
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('+', this.x + this.w/2 - cameraX, this.y + 24);
    } else if (this.type === 'neg_node') {
      ctx.fillStyle = '#3b82f6';
      ctx.shadowColor = '#3b82f6';
      ctx.fillRect(this.x - cameraX, this.y, this.w, this.h);
      ctx.fillStyle = '#ffffff';
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('-', this.x + this.w/2 - cameraX, this.y + 22);
    } else if (this.type === 'portal') {
      ctx.fillStyle = '#22c55e';
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.ellipse(this.x + this.w/2 - cameraX, this.y + this.h/2, this.w/2, this.h/2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

// Helper to pull active styles in context
function var_css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
