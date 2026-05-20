# 🚀 Star Hopper - Coding & Physics Platformer

<a href="https://www.buymeacoffee.com/hshakeri" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 42px !important;width: 151px !important;" >
</a>

Welcome to **Star Hopper**, an interactive, zero-dependency, retro-futuristic 2D physics platformer built to teach kids (and curious adults) programming and physics concepts in an engaging, visual way!

Run around, jump across space stations, and type lines of code in the **KidCode terminal** to rewrite the laws of physics, change constants like gravity, spawn items, or make silly custom rules!

---

## 🎮 Play Online (GitHub Pages)
The game is hosted live on GitHub Pages! Click below to start hopping across planets:
👉 **[Play Star Hopper Live!](https://hshakeri.github.io/star-hopper/)**

---

## 🪐 Features

- **5 Planets, 5 Physics Settings**: Travel from the cozy fields of Earth to the floaty Moon, the crushing gravity of Jupiter, the icy slips of Glacies, and the magnetic pulls of Mag-Net.
- **Real-Time Force Vectors**: See gravity, velocity, friction, and electromagnets displayed as live neon arrows on your character.
- **Dynamic Energy Telemetry**: Interactive graphs show Kinetic Energy (KE), Potential Energy (PE), and Total Mechanical Energy in real time.
- **Programmable Game Loop ("KidCode")**: Write commands to change gravity, friction, jump power, or execute loops and custom event triggers.
- **Procedural Synthesizer Audio**: In-game Web Audio API synth plays jumping sweeps, typewriter clicks, and loopable chiptune tracks (including an ambient chiptune adaptation of Amos Roddy's *"Tears"*).

---

## 🕹️ Controls

- **Move**: `Arrow Left` / `Arrow Right`
- **Jump**: `Arrow Up`, `W`, or `Space`
- **Swap Character**: `C` or `Shift` (Swap between Star & Hopper)
- **Star (Lightweight / Agile)**:
  - Hold `Space` in mid-air to **Glide/Float** using high drag coefficients.
- **Hopper (Heavyweight / Tech)**:
  - Hold `Space` in mid-air to fire **Rocket Boosters**.
  - Hold `Arrow Down` or `S` on the ground to deploy **Spiked Boots** (extreme friction).
  - Hold `Arrow Down` or `S` in mid-air to engage **Electromagnets** (attracts/repels glowing magnet blocks).

---

## 🪄 KidCode Programming Reference

Use the console terminal on the right to edit the environment. You can use direct assignments, loops, or events!

### 1. Variables
* `gravity` (Default `1.0`): Change the planet's vertical acceleration.
* `friction` (Default `0.1`): Change slide slipperiness.
* `jump_power` (Default `12`): Set how high you jump.
* `music`: Set the background track (`"earth"`, `"moon"`, `"jupiter"`, `"glacies"`, `"magnet"`, `"tears"`, or `"none"`).

### 2. Actions & Spawning
* `spawn_box()`: Spawn a physics-enabled crate.
* `spawn_spring()`: Spawn a bouncy spring launcher.
* `spawn_coin()`: Spawn a gold coin.
* `say("message")`: Make your active character say something.
* `play_music("track")`: Play a specific chiptune melody.

### 3. Logic & Loops
* **Loops**:
  ```python
  repeat 5: spawn_coin()
  ```
  ```python
  for i in range(3): spawn_box()
  ```
* **Event Triggers (when Hooks)**:
  ```python
  when player.lands: say("Boing!")
  ```
  ```python
  when player.swaps: play_music("tears")
  ```

---

## ☕ Support the Project
If you enjoyed playing or learning with Star Hopper, consider buying me a coffee!

<a href="https://www.buymeacoffee.com/hshakeri" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 42px !important;width: 151px !important;" >
</a>
