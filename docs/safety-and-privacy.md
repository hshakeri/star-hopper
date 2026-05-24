# Safety & Privacy Policy: Star Hopper Lab 🔒

Star Hopper is designed from the ground up to provide a safe, secure, and distraction-free learning environment for children, students, parents, and educators.

---

## 🛡️ Privacy-Preserving by Design
Star Hopper is engineered from the ground up to protect children's online safety and ensure complete data privacy:
*   **Zero Personal Information Collected:** We do not ask for, store, or transmit names, email addresses, phone numbers, or physical locations.
*   **No Accounts Required:** Progress is saved locally in your browser cache.
*   **No Social Features:** No chat rooms, comments, or direct messaging.
*   **Optional Parent/Teacher Cloud Sync (Ages 13+):** Students can optionally connect their personal GitHub account to backup progress. To protect credentials, Personal Access Tokens are stored in temporary memory (`sessionStorage`) and wiped automatically when the browser tab is closed. All connections occur directly with the official GitHub API; no third-party servers receive your credentials.

---

## 💻 Sandboxed Execution & System Security
The KidCode compiler built into Star Hopper is engineered for complete system safety:
1. **No `eval()` Usage**: The terminal does not run arbitrary JavaScript strings on the user's browser. It uses a custom lexical tokenizer and parser that only allows safe, pre-approved commands (`gravity`, `friction`, `jump`, `spawn_box`, `loop`, `if`, etc.).
2. **Infinite Loop Safeguards**: KidCode checks all loop and repetition blocks. If a loop attempts to run more than **30 times** or spawn more than **20 objects**, the interpreter halts execution immediately and prints a friendly warning. This prevents browser freeze-ups and system crashes.
3. **No Network Access**: The game logic is 100% client-side. The compiler cannot make API calls, fetch resources, or leak terminal inputs.

---

## 🌐 Ad-Free and Offline-Ready
* **No Third-Party Ads**: No banner ads, trackers, or video popups.
* **Offline Functionality**: The entire project can be downloaded, cloned, or run locally on a machine without any active internet connection.
