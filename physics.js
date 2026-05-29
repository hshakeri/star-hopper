// physics.js - 2D physics engine handling AABB collisions, trajectory paths, vector telemetry, and magnetism

class PhysicsEngine {
  constructor() {
    this.maxCollisionStep = TILE_SIZE / 2;
  }

  // Resolves collisions against tilemaps and interactive objects (like crates)
  resolveWorldCollisions(entity, tilemap, spawnedBoxes, game) {
    let onGround = false;
    let touchingType = 'earth';
    const boxes = spawnedBoxes || [];
    const totalVx = entity.vx;
    const totalVy = entity.vy;
    const stepCount = Math.max(1, Math.ceil(Math.max(Math.abs(totalVx), Math.abs(totalVy)) / this.maxCollisionStep));

    for (let step = 0; step < stepCount; step++) {
      // --- 1. Move Horizontally & Resolve ---
      if (entity.vx !== 0) {
        entity.x += totalVx / stepCount;

        // Tilemap check X
        let collisionsX = this.getTileCollisions(entity, tilemap, { solidBottomOutOfBounds: false });
        for (const t of collisionsX) {
          if (totalVx > 0) {
            entity.x = t.c * TILE_SIZE - entity.w;
            entity.vx = 0;
          } else if (totalVx < 0) {
            entity.x = (t.c + 1) * TILE_SIZE;
            entity.vx = 0;
          }
        }

        // Spawned Crate boxes check X
        for (const box of boxes) {
          if (box.collected) continue;
          if (this.isOverlapping(entity, box)) {
            if (totalVx > 0) {
              entity.x = box.x - entity.w;
              entity.vx = 0;
            } else if (totalVx < 0) {
              entity.x = box.x + box.w;
              entity.vx = 0;
            }
          }
        }
      }

      // --- 2. Move Vertically & Resolve ---
      if (entity.vy !== 0) {
        entity.y += totalVy / stepCount;

        // Tilemap check Y
        let collisionsY = this.getTileCollisions(entity, tilemap, { solidBottomOutOfBounds: false });
        for (const t of collisionsY) {
          if (totalVy > 0) {
            entity.y = t.r * TILE_SIZE - entity.h;
            entity.vy = 0;
            onGround = true;
            entity.isJumping = false;

            // Ground type check
            if (game && game.currentPlanetIndex === 3) {
              touchingType = 'ice';
            } else {
              touchingType = 'earth';
            }
          } else if (totalVy < 0) {
            entity.y = (t.r + 1) * TILE_SIZE;
            entity.vy = 0;
          }
        }

        // Spawned Crate boxes check Y
        for (const box of boxes) {
          if (box.collected) continue;
          if (this.isOverlapping(entity, box)) {
            if (totalVy > 0) {
              entity.y = box.y - entity.h;
              entity.vy = 0;
              onGround = true;
              entity.isJumping = false;
              touchingType = 'wood';
            } else if (totalVy < 0) {
              entity.y = box.y + box.h;
              entity.vy = 0;
            }
          }
        }
      }
    }

    entity.onGround = onGround;
    if (onGround) {
      entity.touchingGroundType = touchingType;
    } else {
      entity.touchingGroundType = 'none';
    }

    // Safety clamp to keep player within world boundaries and prevent getting stuck out of bounds
    const maxWorldX = (tilemap[0].length * TILE_SIZE) - entity.w;
    if (entity.x < 0) {
      entity.x = 0;
      entity.vx = 0;
    } else if (entity.x > maxWorldX) {
      entity.x = maxWorldX;
      entity.vx = 0;
    }
    if (entity.y < 0) {
      entity.y = 0;
      entity.vy = 0;
    }
  }

  // Get list of matching tile coordinates the entity is overlapping
  getTileCollisions(entity, tilemap, options = {}) {
    const collisions = [];
    const epsilon = 0.01;
    const solidBottomOutOfBounds = options.solidBottomOutOfBounds !== false;
    const tileValues = options.tileValues || [1];
    const colLeft = Math.floor(entity.x / TILE_SIZE);
    const colRight = Math.floor((entity.x + entity.w - epsilon) / TILE_SIZE);
    const rowTop = Math.floor(entity.y / TILE_SIZE);
    const rowBottom = Math.floor((entity.y + entity.h - epsilon) / TILE_SIZE);

    const mapHeight = tilemap.length;
    const mapWidth = tilemap[0].length;

    for (let r = rowTop; r <= rowBottom; r++) {
      for (let c = colLeft; c <= colRight; c++) {
        // Side and ceiling bounds are solid; falling below the map is allowed so death zones work.
        if (r >= mapHeight && !solidBottomOutOfBounds) {
          continue;
        }

        if (r < 0 || r >= mapHeight || c < 0 || c >= mapWidth) {
          collisions.push({ r, c });
        } else if (tileValues.includes(tilemap[r][c])) {
          collisions.push({ r, c });
        }
      }
    }
    return collisions;
  }

  getHazardCollisions(entity, tilemap) {
    return this.getTileCollisions(entity, tilemap, {
      solidBottomOutOfBounds: false,
      tileValues: [2]
    });
  }

  // Check overlap of two objects
  isOverlapping(a, b) {
    return a.x < b.x + b.w &&
           a.x + a.w > b.x &&
           a.y < b.y + b.h &&
           a.y + a.h > b.y;
  }

  // Handle magnetic attraction/repulsion forces for Hopper
  applyMagnetism(player, interactiveObjects, currentPlanet) {
    if (player.charType !== 'hopper' || !player.magnetActive) return;

    const hasMagnetOverride = Compiler.env.magnetStrength !== null && Compiler.env.magnetStrength !== undefined;
    const baseMagnetStrength = hasMagnetOverride ? Compiler.env.magnetStrength : (currentPlanet.physics.magnetStrength || 1.2);
    
    // Read the magnet environment setting, fallback to active state
    let polarity = Compiler.env.magnet;
    if (!polarity) polarity = Compiler.env.magnetPole || 'north';

    for (const obj of interactiveObjects) {
      if (obj.type !== 'pos_node' && obj.type !== 'neg_node') continue;

      // Distance check
      const dx = (obj.x + obj.w/2) - (player.x + player.w/2);
      const dy = (obj.y + obj.h/2) - (player.y + player.h/2);
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0.001 && dist < 180) {
        // Evaluate attraction:
        // 'positive', '+', or 'north' polarity attracts to 'neg_node' (-) and repels from 'pos_node' (+)
        // 'negative', '-', or 'south' polarity attracts to 'pos_node' (+) and repels from 'neg_node' (-)
        let attract = false;
        if (polarity === 'positive' || polarity === '+' || polarity === 'north') {
          attract = (obj.type === 'neg_node');
        } else {
          attract = (obj.type === 'pos_node');
        }

        const force = baseMagnetStrength * (1.2 - (dist / 180));
        
        if (attract) {
          player.vx += (dx / dist) * force * 0.5;
          player.vy += (dy / dist) * force;
          
          if (Math.random() < 0.3) {
            Particles.spawn(
              player.x + player.w/2 + (Math.random() - 0.5) * 10,
              player.y + player.h/2 + (Math.random() - 0.5) * 10,
              obj.type === 'pos_node' ? '#ef4444' : '#3b82f6',
              1.5,
              (dx / dist) * 2 + (Math.random() - 0.5),
              (dy / dist) * 2 + (Math.random() - 0.5),
              15,
              'glow'
            );
          }
        } else {
          player.vx -= (dx / dist) * force * 0.5;
          player.vy -= (dy / dist) * force;
        }
      }
    }
  }

  // Predicts landing path using Euler steps
  calculateTrajectory(player, tilemap, spawnedBoxes, currentPlanet) {
    const dots = [];
    
    // Simulate starting state
    let tempX = player.x;
    let tempY = player.y;
    let tempVx = player.vx;
    let tempVy = player.vy;

    const baseGravity = Compiler.env.gravity !== null ? Compiler.env.gravity : currentPlanet.physics.gravity;
    const baseFriction = Compiler.env.friction !== null ? Compiler.env.friction : currentPlanet.physics.friction;

    let gravityForce = baseGravity;
    let horizontalFriction = baseFriction;

    // Gravity is mass-independent free-fall (matches entities.js); mass affects speed/jump.
    if (player.charType === 'star') {
      gravityForce = baseGravity * 0.7;
    } else {
      gravityForce = baseGravity * 1.3;
    }

    const stepCount = 50;
    const saveFrequency = 2;

    const mockEntity = {
      x: tempX,
      y: tempY,
      w: player.w,
      h: player.h,
      vx: tempVx,
      vy: tempVy
    };

    for (let i = 0; i < stepCount; i++) {
      mockEntity.vy += gravityForce;
      if (mockEntity.vy > 12) mockEntity.vy = 12;

      mockEntity.vx *= horizontalFriction;

      mockEntity.x += mockEntity.vx;
      let collX = this.getTileCollisions(mockEntity, tilemap);
      if (collX.length > 0) break;

      mockEntity.y += mockEntity.vy;
      let collY = this.getTileCollisions(mockEntity, tilemap);
      if (collY.length > 0) break;

      let hitBox = false;
      for (const box of spawnedBoxes) {
        if (box.collected) continue;
        if (this.isOverlapping(mockEntity, box)) {
          hitBox = true;
          break;
        }
      }
      if (hitBox) break;

      if (i % saveFrequency === 0) {
        dots.push({ x: mockEntity.x + mockEntity.w/2, y: mockEntity.y + mockEntity.h/2 });
      }
    }

    return dots;
  }

  // Draw force vectors originating from player center
  drawForceVectors(ctx, player, currentPlanet, cameraX) {
    const px = player.x + player.w/2 - cameraX;
    const py = player.y + player.h/2;

    const baseGravity = Compiler.env.gravity !== null ? Compiler.env.gravity : currentPlanet.physics.gravity;
    let gravityVal = (player.charType === 'star') ? baseGravity * 0.7 : baseGravity * 1.3;

    // 1. Gravity Vector (Green)
    this.drawArrow(ctx, px, py, px, py + (gravityVal * 40), '#4ade80', 2);

    // 2. Velocity vector (Blue)
    if (Math.abs(player.vx) > 0.1 || Math.abs(player.vy) > 0.1) {
      this.drawArrow(ctx, px, py, px + (player.vx * 8), py + (player.vy * 8), '#38bdf8', 2.5);
    }

    // 3. Friction vector (Red)
    if (player.onGround && Math.abs(player.vx) > 0.1) {
      const activeFriction = Compiler.env.friction !== null ? Compiler.env.friction : currentPlanet.physics.friction;
      this.drawArrow(ctx, px, py + player.h/2, px - (player.vx * 5), py + player.h/2, '#ef4444', 2);
    }

    // 4. Magnet Vector (Pink)
    if (player.charType === 'hopper' && player.magnetActive) {
      let polarity = Compiler.env.magnet;
      if (!polarity) polarity = Compiler.env.magnetPole || 'north';
      const dir = (polarity === 'positive' || polarity === '+' || polarity === 'north') ? -1 : 1;
      this.drawArrow(ctx, px, py - player.h/2, px, py - player.h/2 + (dir * 25), '#ec4899', 2);
    }
  }

  // General arrow drawer
  drawArrow(ctx, fromx, fromy, tox, toy, color, width) {
    const dist = Math.sqrt((tox - fromx) * (tox - fromx) + (toy - fromy) * (toy - fromy));
    if (dist < 3) return;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;

    ctx.beginPath();
    ctx.moveTo(fromx, fromy);
    ctx.lineTo(tox, toy);
    ctx.stroke();

    const angle = Math.atan2(toy - fromy, tox - fromx);
    ctx.beginPath();
    ctx.moveTo(tox, toy);
    ctx.lineTo(tox - 6 * Math.cos(angle - Math.PI / 6), toy - 6 * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(tox - 6 * Math.cos(angle + Math.PI / 6), toy - 6 * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
  }
}

const Physics = new PhysicsEngine();
