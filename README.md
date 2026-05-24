# 🚀 Star Hopper - Programmable Physics Lab & Coding Playground

> **Star Hopper is an open-source physics-and-coding playground where kids learn by rewriting the laws of a tiny universe.**

Star Hopper is a zero-dependency, retro-futuristic 2D physics simulation laboratory disguised as a space platformer. It is designed to teach students, parents, and educators computational thinking and physics modeling through active experimentation.

---

## 🎮 Play Online (GitHub Pages)
The space laboratory is live and hosted on GitHub Pages:
👉 **[Launch Star Hopper Space Lab Live!](https://hshakeri.github.io/star-hopper/)**

---

## 🔭 The Learning Loop: Observe, Predict, Code, Test, Explain
Star Hopper is built around an evidence-based pedagogical loop:
1. **Observe:** Telemetry graphs and real-time neon force vectors (gravity, velocity, electromagnets) visualize invisible forces.
2. **Predict:** Students observe physics obstacles and predict how changing environment constants affects motion.
3. **Code:** The sandboxed **KidCode** console allows students to reprogram the universe using python-like syntax.
4. **Test:** Run, jump, glide, and slide to test predictions in real-time.
5. **Explain:** Log reflections in the **Science Notebook** and print a custom cadet graduation certificate.

---

## 🪐 Core Features

- **5 Interactive Worlds**: Explore custom tilemaps on Earth (Base Camp), the Moon (Low Gravity Canyons), Jupiter (Crushing Trenches), Glacies (Zero Friction Slides), and Mag-Net (Electromagnetic Pulls).
- **KidCode Sandboxed Compiler**: A custom-built lexical tokenizer, parser, and runtime interpreter supporting variable assignment, repeat loops, conditional event hooks (`when player.lands: repeat 3: spawn_coin()`), and safety-critical thresholds to prevent infinite loops.
- **Spaceship Orbital Navigator**: Switch to the spaceship control panel to model circular, elliptical, and hyperbolic trajectories around planetary gravity wells using Velocity Verlet orbital integrations.
- **Telemetry gauges**: Live chart displays plotting Potential Energy ($PE$), Kinetic Energy ($KE$), and Total Mechanical Energy ($TE$).
- **Procedural Synthesizer**: Implements Web Audio API audio synthesis, generating chiptunes, jump sweeps, and warning beeps dynamically without external asset loads.

---

## 🏫 Parent & Teacher Resources
We provide printable, curriculum-aligned lesson templates under the **Guides** tab:
*   **Parent Lab Card ([docs/parent-card.md](docs/parent-card.md)):** Quick vocabulary check and a 15-minute conversation coaching routine.
*   **Classroom Lesson Plan ([docs/teacher-card.md](docs/teacher-card.md)):** NGSS MS-PS2-2 & CSTA 1B-AP-10 standards alignment, 45-minute lesson agenda, and assessment keys.
*   **Student Inquiry Worksheet ([docs/student-lab-sheet.md](docs/student-lab-sheet.md)):** Guided worksheet to record hypothesis, code constants, and telemetry results.

*You can print these materials directly from the in-game Guides tab by clicking the Print buttons (optimized with custom `@media print` CSS templates).*

---

## 🔒 Privacy-Preserving by Design
*   **No Accounts & No Ads:** No registration, tracking pixels, ads, or cookies.
*   **Session-Only Token Storage:** Optional Cloud Gist sync stores GitHub Personal Access Tokens (PATs) in temporary session memory (`sessionStorage`) only. Credentials are never written to disk or sent to third-party databases.
*   **Local Save Export/Import:** Students can export a secure local `.json` file of their achievements and notebook reflections, allowing offline backup and recovery.

---

## 🧪 Integration & Unit Tests
To verify compiler safety limits, event registrations, and velocity calculations, open the automated test dashboard:
👉 **[Run Automated Regression Tests](tests.html)** (or open `tests.html` in your browser).

---

## 💖 Support the STEM Roadmap
Star Hopper is free software developed to support open science education. If this tool brought a smile to your face or helped a student in your classroom, please consider sponsoring our next mission roadmap:

👉 **[Sponsor the Next Mission Roadmap](https://www.buymeacoffee.com/hshakeri)**
