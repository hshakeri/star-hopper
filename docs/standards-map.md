# Educational Standards Alignment: Star Hopper Lab 🎯

This document maps Star Hopper's physical mechanics and coding tools to the **Next Generation Science Standards (NGSS)** and the **Computer Science Teachers Association (CSTA)** frameworks.

---

## 🧬 Next Generation Science Standards (NGSS)

### 1. Motion and Stability: Forces and Interactions (MS-PS2)
* **Standard**: **MS-PS2-1** - *Apply Newton’s Third Law to design a solution to a problem involving the motion of two colliding objects.*
  * **Lab Alignment**: Spawning boxes and watching them collide with the player and boundaries. Tuning friction and mass parameters to observe physical reactions.
* **Standard**: **MS-PS2-2** - *Plan an investigation to provide evidence that the change in an object’s motion depends on the sum of the forces on the object and the mass of the object.*
  * **Lab Alignment**: Comparing the light-weight Star (mass $1.0$) with the heavy Hopper (mass $2.5$). Calculating how force vectors change their paths.

### 2. Energy (MS-PS3)
* **Standard**: **MS-PS3-1** - *Construct and interpret graphical displays of data to describe the relationships of kinetic energy to the speed of an object and to the mass of an object.*
  * **Lab Alignment**: Analyzing the real-time Kinetic Energy ($KE = \frac{1}{2}mv^2$) HUD bar as velocity increases during drops.
* **Standard**: **MS-PS3-2** - *Develop a model to describe that when the arrangement of objects interacting at a distance changes, different amounts of potential energy are stored in the system.*
  * **Lab Alignment**: Monitoring Potential Energy ($PE = mgh$) levels as the player reaches higher platforms.
* **Standard**: **MS-PS3-5** - *Construct, use, and present arguments to support the claim that when the kinetic energy of an object changes, energy is transferred to or from the object.*
  * **Lab Alignment**: Documenting potential-to-kinetic energy conversion loops in the Science Notebook.

---

## 💻 Computer Science Standards (CSTA)

### CSTA Level 1B: Grades 3-5 (Ages 8-11)
* **Standard**: **1B-AP-10** - *Create programs that include sequences, events, loops, and conditionals.*
  * **Lab Alignment**: Writing KidCode scripts to handle loops (`loop 5 { spawn_box() }`) and events/triggers (`if y > 300 { gravity = 0.1 }`).
* **Standard**: **1B-AP-11** - *Deconstruct (break down) problems into smaller, manageable subproblems to facilitate the program development process.*
  * **Lab Alignment**: Following the 6-step scientific guide to decompose orbital trajectories.

### CSTA Level 2: Middle School Grades 6-8 (Ages 11-14)
* **Standard**: **2-AP-12** - *Design and iteratively develop programs that combine control structures, including nested loops and compound conditionals.*
  * **Lab Alignment**: Programming multi-conditional physics overrides and sequence scripts inside the space terminal.
