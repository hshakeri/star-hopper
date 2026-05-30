// nav-core.js - Core vector math, angle calculations, and coordinate systems for Star Hopper Solar Navigator
// Equips the simulation with solid orbital mechanics utilities under the window.Nav namespace.

window.Nav = window.Nav || {};

(function(Nav) {
  // --- 1. TOY SIMULATION UNITS & CONSTANTS ---
  // To make the math understandable for young scientists, we use clear units:
  // - 1 Space Unit (SU) = 150 pixels (scaled distance for visualization)
  // - 1 Ship Mass Unit (SMU) = arbitrary mass unit for ship components
  // - 1 Earth Mass Unit (EMU) = basis for planetary gravity fields
  // - 1 Time Unit (TU) = 1 mission day in simulation time
  
  Nav.SU_TO_PX = 150; // pixels per Space Unit
  Nav.G = 0.8 / 350877; // Gravitational constant G scaled for 240-day year (was 0.8)
  Nav.viewOffsetX = 0;
  Nav.viewOffsetY = 0;
  Nav.followShip = true; // camera keeps the ship centered until the player pans

  // Convert SU to Pixels (for rendering)
  Nav.suToPx = function(su) {
    return su * Nav.SU_TO_PX;
  };
  
  // Convert Pixels to SU (for physics)
  Nav.pxToSu = function(px) {
    return px / Nav.SU_TO_PX;
  };

  Nav.worldToScreen = function(pos, canvas) {
    return {
      x: canvas.width / 2 + Nav.viewOffsetX + Nav.suToPx(pos.x),
      y: canvas.height / 2 + Nav.viewOffsetY + Nav.suToPx(pos.y)
    };
  };

  Nav.screenToWorld = function(screen, canvas) {
    return {
      x: (screen.x - canvas.width / 2 - Nav.viewOffsetX) / Nav.SU_TO_PX,
      y: (screen.y - canvas.height / 2 - Nav.viewOffsetY) / Nav.SU_TO_PX
    };
  };

  Nav.setZoom = function(nextScale, anchor, canvas) {
    const clampedScale = Math.max(50, Math.min(300, nextScale));
    if (clampedScale === Nav.SU_TO_PX) return;

    if (anchor && canvas) {
      const anchoredWorld = Nav.screenToWorld(anchor, canvas);
      Nav.SU_TO_PX = clampedScale;
      Nav.viewOffsetX = anchor.x - canvas.width / 2 - anchoredWorld.x * Nav.SU_TO_PX;
      Nav.viewOffsetY = anchor.y - canvas.height / 2 - anchoredWorld.y * Nav.SU_TO_PX;
    } else {
      Nav.SU_TO_PX = clampedScale;
    }
  };

  // --- 2. VECTOR 2D MATH UTILITIES ---
  Nav.Vector = {
    create: function(x = 0, y = 0) {
      return { x, y };
    },
    
    add: function(v1, v2) {
      return { x: v1.x + v2.x, y: v1.y + v2.y };
    },
    
    sub: function(v1, v2) {
      return { x: v1.x - v2.x, y: v1.y - v2.y };
    },
    
    scale: function(v, s) {
      return { x: v.x * s, y: v.y * s };
    },
    
    dot: function(v1, v2) {
      return v1.x * v2.x + v1.y * v2.y;
    },
    
    magnitudeSq: function(v) {
      return v.x * v.x + v.y * v.y;
    },
    
    magnitude: function(v) {
      return Math.sqrt(v.x * v.x + v.y * v.y);
    },
    
    normalize: function(v) {
      const mag = Math.sqrt(v.x * v.x + v.y * v.y);
      if (mag === 0) return { x: 0, y: 0 };
      return { x: v.x / mag, y: v.y / mag };
    },
    
    distanceSq: function(v1, v2) {
      const dx = v1.x - v2.x;
      const dy = v1.y - v2.y;
      return dx * dx + dy * dy;
    },
    
    distance: function(v1, v2) {
      return Math.sqrt(this.distanceSq(v1, v2));
    }
  };

  // --- 3. ANGLE & ORBITAL ALIGNMENT UTILITIES ---
  Nav.Angle = {
    // Normalizes angle between -PI and PI
    normalize: function(angle) {
      while (angle <= -Math.PI) angle += Math.PI * 2;
      while (angle > Math.PI) angle -= Math.PI * 2;
      return angle;
    },
    
    // Calculates the absolute angular difference between two angles
    difference: function(a1, a2) {
      return this.normalize(a1 - a2);
    },
    
    // Linearly interpolates between angles (taking the shortest path)
    interpolate: function(current, target, step) {
      const diff = this.difference(target, current);
      if (Math.abs(diff) < step) return target;
      return this.normalize(current + Math.sign(diff) * step);
    }
  };

})(window.Nav);
