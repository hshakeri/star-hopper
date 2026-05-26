// audio.js - Web Audio API synthesizer for sound effects and loopable chiptune space music

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.bgmInterval = null;
    this.currentBgm = null;
    this.isMuted = true;
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
    }
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
    gain.connect(this.ctx.destination);

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
    gain.connect(this.ctx.destination);

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
      gain.connect(this.ctx.destination);
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

    // Small mechanic click
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.type = 'sine';
    const now = this.ctx.currentTime;
    osc.frequency.setValueAtTime(800, now);
    gain.gain.setValueAtTime(0.02, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.03);
    osc.start(now);
    osc.stop(now + 0.03);
  }

  playSuccess() {
    this.resume();
    if (this.isMuted || !this.ctx) return;

    const now = this.ctx.currentTime;
    const playTone = (freq, start, duration) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
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
    gain.connect(this.ctx.destination);
    
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
    gain.connect(this.ctx.destination);
    
    osc.type = 'sine';
    const now = this.ctx.currentTime;
    
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(450, now + 0.1);
    
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.15);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  // Loopable Background Chiptune Tracks
  startBGM(planetId) {
    this.resume();
    this.stopBGM();
    this.currentBgm = planetId;
    if (window.updateMusicMenuState) {
      window.updateMusicMenuState();
    }
    if (this.isMuted || !this.ctx) return;
    let step = 0;

    // Define different looping notes/patterns based on planets
    let melody = [];
    let bass = [];
    let tempo = 180; // ms per beat

    if (planetId === 0) { // Earth: Uplifting, major chord arpeggio
      melody = ["C4", "E4", "G4", "C5", "G4", "E4", "F4", "A4", "C5", "F4", "G4", "B4", "D5", "G4", "C4", "C4"];
      bass = ["C3", "C3", "C3", "C3", "F3", "F3", "F3", "F3", "G3", "G3", "G3", "G3", "C3", "C3", "C3", "C3"];
    } else if (planetId === 1) { // Moon: Floatier, slower pace
      melody = ["E4", "G4", "B4", "E5", "D5", "B4", "A4", "G4", "A4", "C5", "E5", "A4", "B4", "G4", "E4", "E4"];
      bass = ["E3", "E3", "E3", "E3", "G3", "G3", "G3", "G3", "A3", "A3", "A3", "A3", "E3", "E3", "E3", "E3"];
      tempo = 240;
    } else if (planetId === 2) { // Jupiter: Heavy, minor, energetic
      melody = ["A4", "C5", "E5", "A4", "D5", "F5", "D5", "A4", "E5", "G5", "E5", "A4", "A4", "A4", "A4", "A4"];
      bass = ["A3", "A3", "A3", "A3", "D3", "D3", "D3", "D3", "E3", "E3", "E3", "E3", "A3", "A3", "A3", "A3"];
      tempo = 140;
    } else if (planetId === 3) { // Glacies: Crystal chimes, high frequencies
      melody = ["C5", "G5", "E5", "C5", "A5", "E5", "C5", "A4", "G4", "D5", "B4", "G4", "C5", "E5", "G5", "C5"];
      bass = ["C3", "C3", "G3", "G3", "A3", "A3", "F3", "F3", "G3", "G3", "D3", "D3", "C3", "C3", "C3", "C3"];
      tempo = 200;
    } else if (planetId === 4) { // Mag-Net: Sci-fi, chromatic, eerie
      melody = ["C4", "F#4", "G4", "C#5", "D5", "G#4", "A4", "D#4", "E4", "A4", "B4", "E5", "C4", "C4", "C4", "C4"];
      bass = ["C3", "C3", "F#3", "F#3", "D3", "D3", "G#3", "G#3", "A3", "A3", "A3", "A3", "C3", "C3", "C3", "C3"];
      tempo = 160;
    } else { // Tears: Ambient Minecraft style (by Amos Roddy)
      melody = [
        "F#4", "C#4", "A4", "C#4", "C#5", "C#4", "E5", "C#4", // F#m arpeggio
        "D5",  "A4",  "C#5", "A4",  "B4",  "A4",  "A4", "F#4", // D Major arpeggio
        "D5",  "A4",  "C#5", "A4",  "B4",  "A4",  "A4", "F4",  // D Minor arpeggio (haunting shift)
        "C#5", "G#4", "B4",  "G#4", "A4",  "G#4", "G#4", "E4"  // C# sus/resolution
      ];
      bass = [
        "F#2", " ", "F#3", " ", "F#2", " ", "F#3", " ",
        "D2",  " ", "D3",  " ", "D2",  " ", "D3",  " ",
        "D2",  " ", "D3",  " ", "D2",  " ", "D3",  " ",
        "C#2", " ", "C#3", " ", "C#2", " ", "C#3", " "
      ];
      tempo = 400; // Slower, floatier ambient pace
    }

    const scheduleNext = () => {
      if (!this.ctx || this.isMuted) return;
      const now = this.ctx.currentTime;
      
      // Melody note (sine/triangle wave, soft volume)
      if (melody[step] && melody[step] !== " ") {
        const oscMel = this.ctx.createOscillator();
        const gainMel = this.ctx.createGain();
        oscMel.connect(gainMel);
        gainMel.connect(this.ctx.destination);
        oscMel.type = (planetId === 3) ? 'sine' : 'triangle';
        oscMel.frequency.setValueAtTime(this.getNoteFreq(melody[step]), now);
        gainMel.gain.setValueAtTime(0.015, now);
        gainMel.gain.linearRampToValueAtTime(0.001, now + (tempo / 1000) * 0.95);
        oscMel.start(now);
        oscMel.stop(now + (tempo / 1000));
      }

      // Bass note (triangle/saw wave, low volume)
      if (step % 2 === 0 && bass[step]) {
        const oscBass = this.ctx.createOscillator();
        const gainBass = this.ctx.createGain();
        oscBass.connect(gainBass);
        gainBass.connect(this.ctx.destination);
        oscBass.type = 'triangle';
        oscBass.frequency.setValueAtTime(this.getNoteFreq(bass[step]), now);
        gainBass.gain.setValueAtTime(0.03, now);
        gainBass.gain.linearRampToValueAtTime(0.001, now + (tempo / 1000) * 1.9);
        oscBass.start(now);
        oscBass.stop(now + (tempo / 1000) * 2);
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
