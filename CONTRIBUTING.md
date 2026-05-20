# Contributing to Star Hopper Space Laboratory 🧑‍🚀

Thank you for choosing to contribute to Star Hopper! Your support helps make science and coding education open and accessible to children all around the world.

---

## 🛠️ Getting Started in Development

Star Hopper has zero external dependencies! You only need a simple local HTTP server to run the full application.

### 1. Clone & Spin up the Server
```bash
# Start a simple Python local server
python3 -m http.server 8000
```
Then visit `http://localhost:8000` in your web browser.

### 2. Code Architecture Guide
* [index.html](file:///Users/hs9hd/.gemini/antigravity/scratch/star-hopper/index.html): Document structure, tabbed mode container layout.
* [style.css](file:///Users/hs9hd/.gemini/antigravity/scratch/star-hopper/style.css): Custom CSS styles, glassmorphism UI, typography, and print-media overrides.
* [game.js](file:///Users/hs9hd/.gemini/antigravity/scratch/star-hopper/game.js): Orchestrates the primary game loop, entity positions, and portal collisions.
* [physics.js](file:///Users/hs9hd/.gemini/antigravity/scratch/star-hopper/physics.js): Calculates coordinate collisions, magnetic forces, and restitution.
* [interpreter.js](file:///Users/hs9hd/.gemini/antigravity/scratch/star-hopper/interpreter.js): Parses and executes KidCode sandbox scripts.
* [missions.js](file:///Users/hs9hd/.gemini/antigravity/scratch/star-hopper/missions.js): Stores curriculum mission validation functions and inquiry reflections.
* [notebook.js](file:///Users/hs9hd/.gemini/antigravity/scratch/star-hopper/notebook.js): Logs telemetry variables, journal responses, and print triggers.
* [navigator.js](file:///Users/hs9hd/.gemini/antigravity/scratch/star-hopper/navigator.js): Computes Newtonian orbital simulations using Velocity Verlet integration.

---

## 📬 Pull Request (PR) Checklist

Before submitting a Pull Request, please ensure:
1. **Formatting**: Code follows a clean structure. Avoid adding external dependencies (e.g. jQuery, React, Bootstrap) unless explicitly discussed.
2. **Offline-first Integrity**: The codebase must remain 100% client-side. No tracking scripts or external tracking dependencies are allowed.
3. **Commit Identity**: All commits should align with your GitHub user account details to keep history clean.

---

## 🤝 Code of Conduct
We want to keep this project welcoming, encouraging, and supportive. We follow standard respectful open-source practices. Please be kind, collaborative, and helpful to all space science cadets!
