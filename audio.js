// audio.js - Web Audio API synthesizer for sound effects and loopable chiptune space music

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.bgmInterval = null;
    this.currentBgm = null;
    this.preSurvivalBgm = null;
    this.isMuted = true;
    this.masterGain = null;
    this.masterVolume = this.loadMasterVolume();
    this.trackNames = [
      "Earth Base", "Moon Orbit", "Jupiter Core", "Glacies Ice", "Mag Field", "Tears",
      "Budget Master", "Acid Craft"
    ];
    this.notes = {
      C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
      C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
      C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.00
    };
  }

  init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.applyMasterVolume();
    }
  }

  normalizeMasterVolume(value, fallback = 0.75) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(1, n));
  }

  loadMasterVolume() {
    if (typeof localStorage === 'undefined') return 0.75;
    const stored = localStorage.getItem('sh-master-volume');
    return this.normalizeMasterVolume(stored, 0.75);
  }

  applyMasterVolume() {
    if (!this.masterGain || !this.ctx) return;
    this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
  }

  setMasterVolume(value, persist = true) {
    this.masterVolume = this.normalizeMasterVolume(value, this.masterVolume);
    this.applyMasterVolume();
    if (persist && typeof localStorage !== 'undefined') {
      localStorage.setItem('sh-master-volume', this.masterVolume.toFixed(2));
    }
    return this.masterVolume;
  }

  getMasterVolumePercent() {
    return Math.round(this.masterVolume * 100);
  }

  connectOutput(node) {
    if (!node || !this.ctx) return;
    node.connect(this.masterGain || this.ctx.destination);
  }

  getNoteFreq(noteName) {
    if (!noteName || noteName === " " || noteName === "-") return 0;
    if (this.notes[noteName]) return this.notes[noteName];
    
    const notesMap = {
      "C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11
    };
    
    const match = noteName.trim().match(/^([A-G]#?)(-?\d+)$/);
    if (!match) return 0;
    
    const note = match[1];
    const octave = parseInt(match[2]);
    const semitones = notesMap[note] + (octave - 4) * 12 - 9;
    const freq = 440 * Math.pow(2, semitones / 12);
    
    this.notes[noteName] = freq;
    return freq;
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Sound Effects (SFX)
  playJump() {
    this.resume();
    if (this.isMuted || !this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    this.connectOutput(gain);

    osc.type = 'triangle';
    const now = this.ctx.currentTime;
    
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(650, now + 0.15);
    
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.15);

    osc.start(now);
    osc.stop(now + 0.16);
  }

  playStomp() {
    this.resume();
    if (this.isMuted || !this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    this.connectOutput(gain);

    osc.type = 'sawtooth';
    const now = this.ctx.currentTime;
    
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.linearRampToValueAtTime(40, now + 0.2);
    
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.25);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  playCoin() {
    this.resume();
    if (this.isMuted || !this.ctx) return;

    const now = this.ctx.currentTime;
    const playTone = (freq, start, duration) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      this.connectOutput(gain);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.08, start);
      gain.gain.linearRampToValueAtTime(0.001, start + duration);
      osc.start(start);
      osc.stop(start + duration);
    };

    playTone(987.77, now, 0.08); // B5
    playTone(1318.51, now + 0.08, 0.2); // E6
  }

  playType() {
    this.resume();
    if (this.isMuted || !this.ctx) return;

    // Retro JRPG voice chime: triangle wave with slightly randomized pitch
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    this.connectOutput(gain);
    osc.type = 'triangle';
    const now = this.ctx.currentTime;
    const freq = 550 + Math.random() * 250;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.025, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.045);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  playSuccess() {
    this.resume();
    if (this.isMuted || !this.ctx) return;

    const now = this.ctx.currentTime;
    const playTone = (freq, start, duration) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      this.connectOutput(gain);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.1, start);
      gain.gain.linearRampToValueAtTime(0.001, start + duration);
      osc.start(start);
      osc.stop(start + duration);
    };

    // Major Triad Arpeggio (C Major)
    playTone(261.63, now, 0.1);       // C4
    playTone(329.63, now + 0.1, 0.1); // E4
    playTone(392.00, now + 0.2, 0.1); // G4
    playTone(523.25, now + 0.3, 0.3); // C5
  }

  playError() {
    this.resume();
    if (this.isMuted || !this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    this.connectOutput(gain);
    
    osc.type = 'sawtooth';
    const now = this.ctx.currentTime;
    
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.linearRampToValueAtTime(90, now + 0.3);
    
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.3);

    osc.start(now);
    osc.stop(now + 0.3);
  }

  playMagnet() {
    this.resume();
    if (this.isMuted || !this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    this.connectOutput(gain);
    
    osc.type = 'sine';
    const now = this.ctx.currentTime;
    
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(450, now + 0.1);
    
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.15);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  // Soft landing "tick" — fires on the airborne→grounded transition so a jump-and-land
  // cycle closes with a satisfying confirmation. Quiet and brief so it never nags.
  playLanding() {
    this.resume();
    if (this.isMuted || !this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    this.connectOutput(gain);

    osc.type = 'sine';
    const now = this.ctx.currentTime;

    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.07);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.08);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  // Rocket thrust whoosh — a breathy sawtooth the Hopper's rocket fires while burning.
  // The caller throttles it (every few frames) so it sustains without clipping. Distinct
  // from playJump so the marquee rocket upgrade actually sounds like a rocket.
  playRocket() {
    this.resume();
    if (this.isMuted || !this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filterIsh = this.ctx.createGain(); // simple two-stage gain for a softer attack
    osc.connect(gain);
    gain.connect(filterIsh);
    this.connectOutput(filterIsh);

    osc.type = 'sawtooth';
    const now = this.ctx.currentTime;

    osc.frequency.setValueAtTime(170 + Math.random() * 70, now);
    osc.frequency.linearRampToValueAtTime(330, now + 0.12);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.14);
    filterIsh.gain.setValueAtTime(0.8, now);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  // Portal unlock fanfare — a bright rising arpeggio for the level-clear / portal moment,
  // deliberately grander than playSuccess so progression lands as a real event.
  playPortalUnlock() {
    this.resume();
    if (this.isMuted || !this.ctx) return;

    const now = this.ctx.currentTime;
    const playTone = (freq, start, duration, type) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      this.connectOutput(gain);
      osc.type = type || 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.12, start);
      gain.gain.linearRampToValueAtTime(0.001, start + duration);
      osc.start(start);
      osc.stop(start + duration);
    };

    // Rising C-major climb, then a shimmering high octave on top.
    playTone(523.25, now, 0.12);                 // C5
    playTone(659.25, now + 0.1, 0.12);           // E5
    playTone(783.99, now + 0.2, 0.12);           // G5
    playTone(1046.50, now + 0.3, 0.35);          // C6
    playTone(1567.98, now + 0.34, 0.4, 'sine');  // G6 shimmer
  }

  // Loopable Background Chiptune Tracks
  getTrackName(trackId) {
    if (trackId === 'survival') return "Survival Rush";
    return this.trackNames[trackId] || "No Music";
  }

  getTrackPattern(trackId) {
    if (trackId === 'survival') {
      return {
        // Original arcade-funk chiptune: fast backbeat, short notes, syncopated bass.
        melody: ["E4", "G4", "A4", " ", "B4", "A4", "G4", "E4", "D4", "E4", "G4", " ", "A4", "G4", "E4", "D4"],
        bass: ["E2", " ", "E2", "G2", " ", "A2", " ", "G2", "D2", " ", "D2", "F#2", " ", "A2", " ", "B2"],
        tempo: 112,
        melodyWave: 'square',
        bassWave: 'sawtooth',
        melodyGain: 0.026,
        bassGain: 0.052,
        noteLength: 0.55,
        bassEvery: 1,
        drums: true
      };
    }

    if (trackId === 0) { // Earth: Uplifting, major chord arpeggio
      return {
        melody: ["C4", "E4", "G4", "C5", "G4", "E4", "F4", "A4", "C5", "F4", "G4", "B4", "D5", "G4", "C4", "C4"],
        bass: ["C3", "C3", "C3", "C3", "F3", "F3", "F3", "F3", "G3", "G3", "G3", "G3", "C3", "C3", "C3", "C3"],
        tempo: 180
      };
    }
    if (trackId === 1) { // Moon: Floatier, slower pace
      return {
        melody: ["E4", "G4", "B4", "E5", "D5", "B4", "A4", "G4", "A4", "C5", "E5", "A4", "B4", "G4", "E4", "E4"],
        bass: ["E3", "E3", "E3", "E3", "G3", "G3", "G3", "G3", "A3", "A3", "A3", "A3", "E3", "E3", "E3", "E3"],
        tempo: 240
      };
    }
    if (trackId === 2) { // Jupiter: Heavy, minor, energetic
      return {
        melody: ["A4", "C5", "E5", "A4", "D5", "F5", "D5", "A4", "E5", "G5", "E5", "A4", "A4", "A4", "A4", "A4"],
        bass: ["A3", "A3", "A3", "A3", "D3", "D3", "D3", "D3", "E3", "E3", "E3", "E3", "A3", "A3", "A3", "A3"],
        tempo: 140
      };
    }
    if (trackId === 3) { // Glacies: Crystal chimes, high frequencies
      return {
        melody: ["C5", "G5", "E5", "C5", "A5", "E5", "C5", "A4", "G4", "D5", "B4", "G4", "C5", "E5", "G5", "C5"],
        bass: ["C3", "C3", "G3", "G3", "A3", "A3", "F3", "F3", "G3", "G3", "D3", "D3", "C3", "C3", "C3", "C3"],
        tempo: 200,
        melodyWave: 'sine'
      };
    }
    if (trackId === 4) { // Mag-Net: Sci-fi, chromatic, eerie
      return {
        melody: ["C4", "F#4", "G4", "C#5", "D5", "G#4", "A4", "D#4", "E4", "A4", "B4", "E5", "C4", "C4", "C4", "C4"],
        bass: ["C3", "C3", "F#3", "F#3", "D3", "D3", "G#3", "G#3", "A3", "A3", "A3", "A3", "C3", "C3", "C3", "C3"],
        tempo: 160
      };
    }
    if (trackId === 6) { // Budget Master: original crunchy, under-mastered arcade pop.
      return {
        melody: ["A4", "C5", "E5", " ", "A4", "G4", "E4", "C4", "D4", "F4", "A4", " ", "G4", "E4", "C4", "A3"],
        bass: ["A2", "A2", " ", "A2", "F2", "F2", " ", "F2", "D2", "D2", " ", "D2", "E2", "E2", "G2", "E2"],
        tempo: 135,
        melodyWave: 'square',
        bassWave: 'triangle',
        melodyGain: 0.022,
        bassGain: 0.046,
        drums: true
      };
    }
    if (trackId === 7) { // Acid Craft: original hypnotic cave-rave arpeggio.
      return {
        melody: ["C4", "C5", "G4", "C5", "D#4", "C5", "G4", "C5", "F4", "C5", "G#4", "C5", "G4", "C5", "A#4", "C5"],
        bass: ["C2", " ", "C2", "G2", "C2", " ", "D#2", "G2", "F2", " ", "F2", "G#2", "G2", " ", "A#2", "G2"],
        tempo: 125,
        melodyWave: 'square',
        bassWave: 'sawtooth',
        melodyGain: 0.018,
        bassGain: 0.04,
        noteLength: 0.42,
        bassEvery: 1,
        drums: true
      };
    }
    return { // Tears: Ambient Minecraft style (by Amos Roddy)
      melody: [
        "F#4", "C#4", "A4", "C#4", "C#5", "C#4", "E5", "C#4",
        "D5",  "A4",  "C#5", "A4",  "B4",  "A4",  "A4", "F#4",
        "D5",  "A4",  "C#5", "A4",  "B4",  "A4",  "A4", "F4",
        "C#5", "G#4", "B4",  "G#4", "A4",  "G#4", "G#4", "E4"
      ],
      bass: [
        "F#2", " ", "F#3", " ", "F#2", " ", "F#3", " ",
        "D2",  " ", "D3",  " ", "D2",  " ", "D3",  " ",
        "D2",  " ", "D3",  " ", "D2",  " ", "D3",  " ",
        "C#2", " ", "C#3", " ", "C#2", " ", "C#3", " "
      ],
      tempo: 400
    };
  }

  startSurvivalBGM(baseTrack) {
    const fallback = (baseTrack !== undefined && baseTrack !== 'survival')
      ? baseTrack
      : (this.currentBgm !== null && this.currentBgm !== 'survival' ? this.currentBgm : this.preSurvivalBgm);
    this.preSurvivalBgm = fallback !== undefined && fallback !== null ? fallback : 0;
    this.startBGM('survival');
  }

  stopSurvivalBGM(fallbackTrack) {
    const nextTrack = fallbackTrack !== undefined && fallbackTrack !== null
      ? fallbackTrack
      : (this.preSurvivalBgm !== null && this.preSurvivalBgm !== undefined ? this.preSurvivalBgm : 0);
    this.preSurvivalBgm = null;
    this.startBGM(nextTrack);
  }

  startBGM(planetId) {
    this.resume();
    this.stopBGM();
    this.currentBgm = planetId;
    if (window.updateMusicMenuState) {
      window.updateMusicMenuState();
    }
    if (this.isMuted || !this.ctx) return;
    let step = 0;
    const pattern = this.getTrackPattern(planetId);
    const melody = pattern.melody;
    const bass = pattern.bass;
    const tempo = pattern.tempo || 180;
    const beatSeconds = tempo / 1000;

    const playTone = (freq, start, duration, type, volume) => {
      if (!freq) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      this.connectOutput(gain);
      osc.type = type || 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(volume || 0.02, start);
      gain.gain.linearRampToValueAtTime(0.001, start + duration);
      osc.start(start);
      osc.stop(start + duration + 0.01);
    };

    const playKick = (now) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      this.connectOutput(gain);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(128, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.08);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.11);
    };

    const playSnare = (now) => {
      playTone(210, now, 0.055, 'sawtooth', 0.026);
      playTone(1180, now + 0.004, 0.035, 'square', 0.012);
    };

    const playHat = (now) => {
      playTone(6400, now, 0.022, 'square', 0.006);
    };

    const scheduleNext = () => {
      if (!this.ctx || this.isMuted) return;
      const now = this.ctx.currentTime;
      const mNote = melody[step];
      const bNote = bass[step];
      
      // Melody note (sine/triangle wave, soft volume)
      if (mNote && mNote !== " ") {
        playTone(
          this.getNoteFreq(mNote),
          now,
          beatSeconds * (pattern.noteLength || 0.95),
          pattern.melodyWave || 'triangle',
          pattern.melodyGain || 0.015
        );
      }

      // Bass note (triangle/saw wave, low volume)
      if (step % (pattern.bassEvery || 2) === 0 && bNote && bNote !== " ") {
        playTone(
          this.getNoteFreq(bNote),
          now,
          beatSeconds * (pattern.bassLength || 1.85),
          pattern.bassWave || 'triangle',
          pattern.bassGain || 0.03
        );
      }

      if (pattern.drums) {
        const beat = step % 16;
        if (beat === 0 || beat === 6 || beat === 8 || beat === 14) playKick(now);
        if (beat === 4 || beat === 12) playSnare(now);
        if (beat % 2 === 1 || beat === 10) playHat(now);
      }

      step = (step + 1) % melody.length;
    };

    // Sequencer interval
    this.bgmInterval = setInterval(scheduleNext, tempo);
  }

  stopBGM() {
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
    this.currentBgm = null;
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      const activeBgm = this.currentBgm;
      this.stopBGM();
      this.currentBgm = activeBgm; // Keep memory of active level
    } else {
      if (this.currentBgm !== null) {
        this.startBGM(this.currentBgm);
      }
    }
    return this.isMuted;
  }
}

// Global Sound Controller singleton
const SFX = new SoundEngine();
