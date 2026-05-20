# Safety & Privacy Policy: Star Hopper Lab 🔒

Star Hopper is designed from the ground up to provide a safe, secure, and distraction-free learning environment for children, students, parents, and educators.

---

## 🛡️ Child Safety & COPPA Compliance
Star Hopper is fully compliant with the **Children's Online Privacy Protection Act (COPPA)**:
* **Zero Personal Information Collected**: We do not ask for, store, or transmit names, email addresses, phone numbers, or physical locations.
* **No Account Creation**: There are no login pages, user accounts, or profile builders.
* **No Social Features**: There is no chat room, public comment area, or direct messaging, preventing any contact with unverified third parties.
* **Optional Client-Side Cloud Sync**: Students can optionally connect their personal GitHub account to backup progress. The token is stored entirely within the client's browser local storage, and all data exchanges occur directly with the official GitHub API. No third-party servers are involved.

---

## 💻 Sandboxed Execution & System Security
The KidCode compiler built into Star Hopper is engineered for complete system safety:
1. **No `eval()` Usage**: The terminal does not run arbitrary JavaScript strings on the user's browser. It uses a custom lexical tokenizer and parser that only allows safe, pre-approved commands (`gravity`, `friction`, `jump`, `spawn_box`, `loop`, `if`, etc.).
2. **Infinite Loop Safeguards**: KidCode checks all loop and repetition blocks. If a loop attempts to run more than **50 times** or spawn more than **10 objects**, the interpreter halts execution immediately and prints a friendly warning. This prevents browser freeze-ups and system crashes.
3. **No Network Access**: The game logic is 100% client-side. The compiler cannot make API calls, fetch resources, or leak terminal inputs.

---

## 🌐 Ad-Free and Offline-Ready
* **No Third-Party Ads**: No banner ads, trackers, or video popups.
* **Offline Functionality**: The entire project can be downloaded, cloned, or run locally on a machine without any active internet connection.
