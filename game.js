// game.js - Star Hopper platformer game engine, loops, level loading, and draw pipelines

class StarHopperGame {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.currentPlanetIndex = 0;
    this.currentPlanet = null;
    
    // Both characters live simultaneously
    this.star = null;
    this.hopper = null;
    this.player = null; // Reference to active character
    
    this.enemies = [];
    this.interactiveObjects = [];
    
    // Spawned entities from user terminal commands
    this.spawnedBoxes = [];
    this.spawnedSprings = [];
    
    // Camera coordinates
    this.cameraX = 0;
    
    // Game state: 'start', 'playing', 'clear', 'gameover'
    this.state = 'start';
    
    // Key state tracker
    this.keys = {};
    
    // Background starfield coordinates
    this.bgStars = [];

    // Coin collection tally
    this.coinsCollected = 0;

    // Track level checkpoint
    this.startX = 64;
    this.startY = 250;

    // Completed missions list
    this.completedMissions = new Set();
  }

  init() {
    this.canvas = document.getElementById("game-canvas");
    this.ctx = this.canvas.getContext("2d");
    
    // Setup background stars
    this.bgStars = [];
    for (let i = 0; i < 80; i++) {
      this.bgStars.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        size: 0.5 + Math.random() * 1.5,
        speed: 0.1 + Math.random() * 0.3
      });
    }

    this.setupControls();
    this.loadPlanet(0);
    setupUIBindings(this);
    
    // Begin Loop
    requestAnimationFrame((t) => this.loop(t));
  }

  setupControls() {
    // Capture keyboard buttons
    window.addEventListener("keydown", (e) => {
      // Prevent scrolling on Space and Arrow keys when focused on game
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
        if (document.activeElement.id !== "console-input") {
          e.preventDefault();
        }
      }

      if (document.activeElement.id === "console-input") return; // skip gameplay inputs if typing code

      this.keys[e.key.toLowerCase()] = true;
      this.keys[e.key] = true; // raw code support

      // Swap button 'c' or 'Shift'
      if (e.key === "c" || e.key === "C" || e.key === "Shift") {
        if (this.state === 'playing') {
          this.player.swap(this);
          // Update active border accent color in CSS
          const color = (this.player.charType === 'star') ? 'var(--neon-cyan)' : 'var(--neon-orange)';
          document.documentElement.style.setProperty('--active-neon', color);
          
          // Trigger dialogue comment on first swap
          this.triggerTutorialDialogue("swap");
        }
      }
    });

    window.addEventListener("keyup", (e) => {
      this.keys[e.key.toLowerCase()] = false;
      this.keys[e.key] = false;
    });

    // Binds Start Screen levels buttons
    const btns = document.querySelectorAll(".level-button");
    btns.forEach(btn => {
      btn.addEventListener("click", () => {
        const id = parseInt(btn.getAttribute("data-level"));
        this.startLevel(id);
      });
    });

    // Next level button
    const nextBtn = document.getElementById("btn-next-level");
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        this.nextPlanet();
      });
    }

    // Reset buttons
    const restartBtn = document.getElementById("btn-restart");
    if (restartBtn) {
      restartBtn.addEventListener("click", () => {
        this.resetLevel();
      });
    }
    
    const retryBtn = document.getElementById("btn-retry");
    if (retryBtn) {
      retryBtn.addEventListener("click", () => {
        this.startLevel(this.currentPlanetIndex);
      });
    }
  }

  startLevel(id) {
    this.state = 'playing';
    const startScr = document.getElementById("start-screen");
    const clearScr = document.getElementById("clear-screen");
    const goScr = document.getElementById("gameover-screen");

    if (startScr) startScr.classList.add("hidden");
    if (clearScr) clearScr.classList.add("hidden");
    if (goScr) goScr.classList.add("hidden");
    this.loadPlanet(id);
  }

  loadPlanet(index) {
    this.currentPlanetIndex = index;
    this.currentPlanet = PLANETS[index];
    
    // Clear terminal overrides
    Compiler.reset();
    
    // Instantiate single character in place
    this.player = new Player(this.startX, this.startY);
    this.player.charType = 'star'; // default start active character style
    
    // Set up aliases for backwards compatibility with missions and rules references
    this.star = this.player;
    this.hopper = this.player;
    
    this.enemies = [];
    this.interactiveObjects = [];
    this.spawnedBoxes = [];
    this.spawnedSprings = [];
    
    this.cameraX = 0;
    this.coinsCollected = 0;
    // Keep global completed missions across planet switches
    Particles.clear();

    // Set variable accent colors in UI
    document.documentElement.style.setProperty('--active-neon', this.currentPlanet.color);
    
    // Load Enemies and Interactive items from tilemap
    const map = this.currentPlanet.map;
    for (let r = 0; r < map.length; r++) {
      for (let c = 0; c < map[r].length; c++) {
        const val = map[r][c];
        const tx = c * TILE_SIZE;
        const ty = r * TILE_SIZE;

        if (val === 3) {
          this.interactiveObjects.push(new InteractiveObject(tx, ty, 'coin'));
        } else if (val === 4) {
          this.interactiveObjects.push(new InteractiveObject(tx, ty, 'trampoline'));
        } else if (val === 5) {
          this.interactiveObjects.push(new InteractiveObject(tx, ty, 'pos_node'));
        } else if (val === 6) {
          this.interactiveObjects.push(new InteractiveObject(tx, ty, 'neg_node'));
        } else if (val === 7) {
          this.interactiveObjects.push(new InteractiveObject(tx, ty, 'portal'));
        } else if (val === 9) {
          let eType = 'bug';
          if (index === 1) eType = 'spore';
          else if (index === 2) eType = 'crusher';
          else if (index === 3) eType = 'penguin';
          else if (index === 4) eType = 'fly';
          
          this.enemies.push(new Enemy(tx, ty, eType));
        }
      }
    }

    // Set document head name
    const titleText = document.getElementById("header-planet-title");
    if (titleText) titleText.textContent = this.currentPlanet.name;
    const subText = document.getElementById("header-planet-sub");
    if (subText) subText.textContent = `// Coordinate: ${this.currentPlanet.tagline}`;

    // Start background music loop
    SFX.startBGM(index);

    // Initial console dialogue
    ui_log_output(`--- Entering orbit of ${this.currentPlanet.name} ---`, "info");
    ui_log_output(`Gravity defaults: g = ${(this.currentPlanet.physics.gravity/0.6*9.8).toFixed(1)} m/s²`, "info");
    
    // Trigger dialogue helper robot text
    this.triggerTutorialDialogue("start");
    // Draw initial mission list
    updateMissionList(this);

    // Start Guided tutorial check if Earth index 0 loaded
    if (typeof checkStartGuidedMode === 'function') {
      checkStartGuidedMode(index);
    }
  }

  triggerTutorialDialogue(trigger) {
    const dialogs = this.currentPlanet.tutorial;
    const item = dialogs.find(d => d.trigger === trigger);
    if (item) {
      showDialogue(item.text, trigger);
    }
  }

  // Spawns items above player (called via compiler terminal functions)
  spawnItemAbovePlayer(type) {
    const px = this.player.x;
    const py = this.player.y - 48; // Spawn 48px above helmet

    if (type === 'coin') {
      this.interactiveObjects.push(new InteractiveObject(px, py, 'coin'));
      Particles.spawnBurst(px + 10, py + 10, '#facc15', 8, 2, 2, 'glow');
    } else if (type === 'box') {
      const box = new InteractiveObject(px, py, 'box');
      this.spawnedBoxes.push(box);
      Particles.spawnBurst(px + 16, py + 16, '#ea580c', 10, 2.5, 3);
    } else if (type === 'spring') {
      const spring = new InteractiveObject(px, py, 'spring');
      this.spawnedSprings.push(spring);
      this.interactiveObjects.push(spring);
      Particles.spawnBurst(px + 16, py + 16, '#f87171', 8, 2, 2.5);
    }
  }

  shrinkAllEnemies() {
    for (const enemy of this.enemies) {
      enemy.scale = 0.5;
      Particles.spawnBurst(enemy.x + enemy.w/2, enemy.y + enemy.h/2, '#ef4444', 5, 2, 2, 'glow');
    }
  }

  bouncePlayer() {
    this.player.vy = -12;
    this.player.onGround = false;
  }

  checkMissions() {
    if (!this.currentPlanet || !this.currentPlanet.missions) return;

    let anyCompletedThisFrame = false;
    for (const mission of this.currentPlanet.missions) {
      if (!this.completedMissions.has(mission.id)) {
        try {
          if (mission.validate(this)) {
            this.completedMissions.add(mission.id);
            anyCompletedThisFrame = true;
            ui_log_output(`★ Mission Complete: ${mission.prompt}`, "success");
            SFX.playSuccess();
            Particles.spawnBurst(this.player.x + this.player.w/2, this.player.y + this.player.h/2, '#facc15', 15, 3, 3, 'glow');
          }
        } catch (err) {
          console.error("Mission validation failed:", err);
        }
      }
    }
    if (anyCompletedThisFrame) {
      updateMissionList(this);
      if (typeof handleGuidedClearHook === 'function') handleGuidedClearHook();
      if (typeof triggerCloudSave === 'function') triggerCloudSave();
    }
  }

  nextPlanet() {
    this.currentPlanetIndex = (this.currentPlanetIndex + 1) % PLANETS.length;
    this.startLevel(this.currentPlanetIndex);
  }

  resetLevel() {
    this.startLevel(this.currentPlanetIndex);
  }

  // Core Game Loop
  loop(timestamp) {
    if (this.state === 'playing') {
      this.update();
      this.draw();
    }
    requestAnimationFrame((t) => this.loop(t));
  }

  update() {
    if (window.navigatorModeActive) {
      if (typeof updateNavigator === 'function') {
        updateNavigator(this);
      }
      return;
    }

    // 1. Process active conditional code triggers first
    Compiler.updateRules(this);

    // 2. Run real-time mission completion validator
    this.checkMissions();

    // 3. Update character inputs and accelerations
    this.player.update(this.keys, this.currentPlanet, this);

    // 4. Magnetic force application
    Physics.applyMagnetism(this.player, this.interactiveObjects, this.currentPlanet);

    // 5. Resolve rigid body collisions
    Physics.resolveWorldCollisions(this.player, this.currentPlanet.map, this.spawnedBoxes, this);

    // 6. Check if player fell out of bounds (dead)
    if (this.player.y > 450) {
      this.killPlayer("fell out of bounds!");
      return;
    }

    // 7. Update camera positioning (lerp horizontal viewport centering)
    const targetCamX = this.player.x - this.canvas.width / 2;
    const maxCamX = (this.currentPlanet.map[0].length * TILE_SIZE) - this.canvas.width;
    this.cameraX += (targetCamX - this.cameraX) * 0.1;
    this.cameraX = Math.max(0, Math.min(maxCamX, this.cameraX));

    // 8. Update active level entities
    for (const enemy of this.enemies) {
      enemy.update(this.currentPlanet.map, this.player);
      
      // Enemy collision check (only active character takes damage)
      if (Physics.isOverlapping(this.player, enemy)) {
        const isStomp = (this.player.vy > 0.5 && this.player.y + this.player.h - this.player.vy <= enemy.y + 6);
        if (isStomp) {
          this.player.vy = -6;
          this.player.hitEnemyThisFrame = true;
          SFX.playStomp();
          Particles.spawnBurst(enemy.x + enemy.w/2, enemy.y + enemy.h/2, '#ef4444', 12, 3, 3, 'glow');
          this.enemies = this.enemies.filter(e => e !== enemy);
        } else {
          this.killPlayer("collision damage from alien life form!");
          return;
        }
      }
    }

    // 9. Update objects and check collisions
    for (const obj of this.interactiveObjects) {
      obj.update();
      if (obj.collected) continue;

      if (Physics.isOverlapping(this.player, obj)) {
        if (obj.type === 'coin') {
          obj.collected = true;
          this.coinsCollected++;
          SFX.playCoin();
          Particles.spawnBurst(obj.x + 8, obj.y + 8, '#facc15', 10, 2, 2.5, 'glow');
          ui_log_output(`✓ Coin Collected! Total: ${this.coinsCollected}`, "success");
        } else if (obj.type === 'trampoline' || obj.type === 'spring') {
          const isTopBounce = (this.player.vy > 0.1 && this.player.y + this.player.h - this.player.vy <= obj.y + 6);
          if (isTopBounce) {
            obj.bounceTimer = 10;
            this.player.vy = -this.currentPlanet.physics.bounceForce * 1.4;
            this.player.onGround = false;
            SFX.playJump();
            Particles.spawnBurst(obj.x + 16, obj.y, '#f87171', 8, 2, 2);
          }
        } else if (obj.type === 'portal') {
          this.clearLevel();
          return;
        }
      }
    }

    // 10. Update spawned box boxes (AABB block pushes)
    for (const box of this.spawnedBoxes) {
      box.update();
    }

    // 11. Update particle systems
    Particles.update();

    // 12. Redraw HUD sidebar charts & variables
    updateHUD(this);
    if (typeof updateNotebook === 'function') {
      updateNotebook(this);
    }

    // 13. Check tutorial spatial triggers
    if (this.player.x > 320 && this.player.x < 420) {
      if (this.currentPlanetIndex === 0) this.triggerTutorialDialogue("wall");
      else if (this.currentPlanetIndex === 1) this.triggerTutorialDialogue("gap");
      else if (this.currentPlanetIndex === 2) this.triggerTutorialDialogue("collapse");
    }
    if (this.player.x > 750 && this.player.x < 850) {
      if (this.currentPlanetIndex === 3) this.triggerTutorialDialogue("slippery");
      else if (this.currentPlanetIndex === 4) this.triggerTutorialDialogue("poles");
    }
  }

  killPlayer(cause) {
    this.state = 'gameover';
    SFX.playError();
    SFX.stopBGM();
    const goScr = document.getElementById("gameover-screen");
    if (goScr) goScr.classList.remove("hidden");
    ui_log_output(`⚠ Star Hopper critical damage: ${cause}`, "error");
    ui_log_output(`Initializing rescue pod... Click Retry to launch.`, "info");
  }

  clearLevel() {
    this.state = 'clear';
    SFX.playSuccess();
    SFX.stopBGM();
    const clearScr = document.getElementById("clear-screen");
    if (clearScr) clearScr.classList.remove("hidden");
    ui_log_output(`✓ Level cleared! Target coordinates secured.`, "success");
  }

  draw() {
    if (window.navigatorModeActive) {
      if (typeof drawNavigator === 'function') {
        drawNavigator(this);
      }
      return;
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 1. Draw Parallax Space Background
    this.drawSpaceBackground();

    // 2. Draw active platform level tilemap
    this.drawTilemap();

    // 3. Draw interactive objects
    for (const obj of this.interactiveObjects) {
      obj.draw(this.ctx, this.cameraX);
    }
    for (const box of this.spawnedBoxes) {
      box.draw(this.ctx, this.cameraX);
    }

    // 4. Draw enemies
    for (const enemy of this.enemies) {
      enemy.draw(this.ctx, this.cameraX);
    }

    // 5. Draw Player Character
    this.player.draw(this.ctx, this.cameraX, this);

    // 6. Draw glowing magnetic lines if active
    this.drawMagneticFields();

    // 7. Draw Dotted Trajectory Line
    this.drawTrajectory();

    // 8. Draw live Force Vectors directly on top of active character
    Physics.drawForceVectors(this.ctx, this.player, this.currentPlanet, this.cameraX);

    // 9. Draw Particle systems
    Particles.draw(this.ctx, this.cameraX);
  }

  drawSpaceBackground() {
    this.ctx.fillStyle = this.currentPlanet.skyColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Parallax stars
    this.ctx.fillStyle = "#ffffff";
    for (const star of this.bgStars) {
      let sx = (star.x - this.cameraX * star.speed) % this.canvas.width;
      if (sx < 0) sx += this.canvas.width;
      
      this.ctx.beginPath();
      this.ctx.arc(sx, star.y, star.size, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  drawTilemap() {
    const map = this.currentPlanet.map;
    const planetId = this.currentPlanetIndex;

    for (let r = 0; r < map.length; r++) {
      for (let c = 0; c < map[r].length; c++) {
        const val = map[r][c];
        if (val !== 1 && val !== 2) continue; // Skip empty space and entities

        const tx = c * TILE_SIZE - this.cameraX;
        const ty = r * TILE_SIZE;

        if (tx + TILE_SIZE < 0 || tx > this.canvas.width) continue;

        this.ctx.save();

        if (val === 1) {
          if (planetId === 0) {
            const isTop = (r > 0 && map[r-1][c] !== 1);
            this.ctx.fillStyle = isTop ? "#22c55e" : "#78350f";
            this.ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
            if (isTop) {
              this.ctx.fillStyle = "#15803d";
              this.ctx.fillRect(tx, ty + TILE_SIZE - 4, TILE_SIZE, 4);
            }
          } else if (planetId === 1) {
            this.ctx.fillStyle = "#475569";
            this.ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
            this.ctx.fillStyle = "#334155";
            this.ctx.beginPath();
            this.ctx.arc(tx + 16, ty + 16, 8, 0, Math.PI*2);
            this.ctx.fill();
          } else if (planetId === 2) {
            this.ctx.fillStyle = "#ea580c";
            this.ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
            this.ctx.strokeStyle = "#9a3412";
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(tx + 2, ty + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          } else if (planetId === 3) {
            this.ctx.fillStyle = "rgba(139, 92, 246, 0.4)";
            this.ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
            this.ctx.strokeStyle = "#a78bfa";
            this.ctx.lineWidth = 1.5;
            this.ctx.strokeRect(tx, ty, TILE_SIZE, TILE_SIZE);
          } else {
            this.ctx.fillStyle = "#0f172a";
            this.ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
            this.ctx.strokeStyle = "#ec4899";
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(tx + 4, ty + 4, TILE_SIZE - 8, TILE_SIZE - 8);
          }
        } else if (val === 2) {
          this.ctx.fillStyle = "#cbd5e1";
          this.ctx.strokeStyle = "#94a3b8";
          this.ctx.beginPath();
          this.ctx.moveTo(tx, ty + TILE_SIZE);
          this.ctx.lineTo(tx + TILE_SIZE/2, ty);
          this.ctx.lineTo(tx + TILE_SIZE, ty + TILE_SIZE);
          this.ctx.closePath();
          this.ctx.fill();
          this.ctx.stroke();
        }

        this.ctx.restore();
      }
    }
  }

  drawTrajectory() {
    const dots = Physics.calculateTrajectory(this.player, this.currentPlanet.map, this.spawnedBoxes, this.currentPlanet);
    
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(74, 222, 128, 0.6)';
    this.ctx.shadowBlur = 4;
    this.ctx.shadowColor = '#4ade80';

    for (let i = 0; i < dots.length; i++) {
      this.ctx.beginPath();
      this.ctx.arc(dots[i].x - this.cameraX, dots[i].y, 2, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  drawMagneticFields() {
    if (this.player.charType !== 'hopper' || !this.player.magnetActive) return;

    this.ctx.save();
    this.ctx.lineWidth = 1.5;
    this.ctx.setLineDash([4, 4]);

    // Read active polarization setting
    let polarity = Compiler.env.magnet;
    if (!polarity) polarity = Compiler.env.magnetPole || 'north';

    const px = this.player.x + this.player.w/2 - this.cameraX;
    const py = this.player.y + this.player.h/2;

    for (const obj of this.interactiveObjects) {
      if (obj.type !== 'pos_node' && obj.type !== 'neg_node') continue;

      const ox = obj.x + obj.w/2 - this.cameraX;
      const oy = obj.y + obj.h/2;

      const dx = ox - px;
      const dy = oy - py;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 180) {
        let attract = false;
        if (polarity === 'positive' || polarity === '+' || polarity === 'north') {
          attract = (obj.type === 'neg_node');
        } else {
          attract = (obj.type === 'pos_node');
        }

        this.ctx.strokeStyle = attract ? 'rgba(56, 189, 248, 0.4)' : 'rgba(239, 68, 68, 0.2)';
        this.ctx.beginPath();
        this.ctx.moveTo(px, py - this.player.h/2);
        this.ctx.quadraticCurveTo((px + ox)/2, (py + oy)/2 - 20, ox, oy);
        this.ctx.stroke();
      }
    }
    this.ctx.restore();
  }
}

// Global Game Engine instance
let Game;
window.addEventListener("load", () => {
  Game = new StarHopperGame();
  Game.init();
});
