/* ================================================================
   SYNTH.JS — A generated soundtrack, no audio files

   Two beds, crossfaded with the world:

     ghibli — a slow pad: three detuned triangle oscillators on a
       pentatonic chord through a lowpass filter whose cutoff is
       swept by an LFO, plus occasional bell notes picked from the
       scale. Vaguely Joe Hisaishi, if you are generous.

     hacker — a saw drone plus a 16th-note arpeggio through a
       resonant filter, scheduled with a lookahead clock rather
       than setTimeout-per-note, because setTimeout jitter is
       audible and a lookahead scheduler is the correct fix.

   Reverb is a convolver fed a procedurally generated impulse
   response (exponentially decaying noise) — no .wav to download.

   Off by default. Nothing is created until a visitor explicitly
   turns it on, which also satisfies browser autoplay policy.
================================================================ */

import { createLogger } from '../core/logger.js';

const log = createLogger('audio');

/* A minor pentatonic gives the Ghibli-ish flavour; the hacker bed
   uses the same set a fifth down so the crossfade stays consonant. */
const PENTATONIC = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33];
const ARP = [110.0, 130.81, 164.81, 196.0, 220.0, 164.81, 130.81, 196.0];

export function createAudioEngine({ bus }) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    log.warn('Web Audio unavailable — the soundtrack is disabled');
    return { supported: false, enable() {}, disable() {}, toggle() {}, setWorld() {}, blip() {}, isOn: () => false };
  }

  let ctx = null;
  let master = null;
  let ghibliBus = null;
  let hackerBus = null;
  let nodes = [];
  let scheduler = 0;
  let nextNoteTime = 0;
  let step = 0;
  let enabled = false;
  let worldMix = 0;

  const LOOKAHEAD = 0.12;    // seconds of notes to schedule ahead
  const TICK = 45;           // scheduler wake-up interval (ms)

  /** Exponentially decaying noise → a plausible small-room reverb. */
  function buildImpulse(seconds = 2.4, decay = 2.6) {
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * seconds);
    const impulse = ctx.createBuffer(2, length, rate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return impulse;
  }

  function build() {
    ctx = new AudioContextClass({ latencyHint: 'interactive' });

    master = ctx.createGain();
    master.gain.value = 0;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.ratio.value = 6;

    const reverb = ctx.createConvolver();
    reverb.buffer = buildImpulse();
    const wet = ctx.createGain();
    wet.gain.value = 0.32;

    master.connect(compressor);
    compressor.connect(ctx.destination);
    compressor.connect(wet);
    wet.connect(reverb);
    reverb.connect(ctx.destination);

    ghibliBus = ctx.createGain();
    hackerBus = ctx.createGain();
    ghibliBus.gain.value = 1 - worldMix;
    hackerBus.gain.value = worldMix;
    ghibliBus.connect(master);
    hackerBus.connect(master);

    buildGhibliPad();
    buildHackerDrone();

    nextNoteTime = ctx.currentTime;
    scheduler = setInterval(tick, TICK);
  }

  function buildGhibliPad() {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.7;
    filter.connect(ghibliBus);

    // Slow cutoff sweep — the "breathing" of the pad.
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.045;
    lfoGain.gain.value = 420;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
    nodes.push(lfo);

    // Three detuned voices on a suspended chord.
    for (const [frequency, detune, gainValue] of [[110, -6, 0.16], [164.81, 4, 0.13], [246.94, 9, 0.09]]) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = frequency;
      osc.detune.value = detune;
      const gain = ctx.createGain();
      gain.gain.value = gainValue;
      osc.connect(gain);
      gain.connect(filter);
      osc.start();
      nodes.push(osc);
    }
  }

  function buildHackerDrone() {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    filter.Q.value = 4;
    filter.connect(hackerBus);

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    const gain = ctx.createGain();
    gain.gain.value = 0.1;
    osc.connect(gain);
    gain.connect(filter);
    osc.start();
    nodes.push(osc);
  }

  /** One plucked note with an exponential decay envelope. */
  function pluck(frequency, time, destination, { type = 'sine', peak = 0.14, decay = 1.6 } = {}) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, time);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(peak, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);

    osc.connect(gain);
    gain.connect(destination);
    osc.start(time);
    osc.stop(time + decay + 0.05);
    osc.onended = () => { gain.disconnect(); };
  }

  /** Lookahead scheduler: queue every note that starts soon. */
  function tick() {
    if (!ctx) return;
    const tempo = 0.125;                       // 16ths at 120bpm

    while (nextNoteTime < ctx.currentTime + LOOKAHEAD) {
      // Hacker arpeggio — every 16th.
      if (worldMix > 0.02) {
        pluck(ARP[step % ARP.length] * 2, nextNoteTime, hackerBus, {
          type: 'square',
          peak: 0.05 * worldMix,
          decay: 0.22,
        });
      }
      // Ghibli bells — sparse, on the beat, randomly voiced.
      if (worldMix < 0.98 && step % 8 === 0 && Math.random() < 0.55) {
        pluck(PENTATONIC[(Math.random() * PENTATONIC.length) | 0], nextNoteTime, ghibliBus, {
          type: 'sine',
          peak: 0.1 * (1 - worldMix),
          decay: 2.4,
        });
      }
      nextNoteTime += tempo;
      step++;
    }
  }

  function fade(param, value, seconds = 1.2) {
    const now = ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(value, now + seconds);
  }

  const engine = {
    supported: true,

    async enable() {
      if (enabled) return true;
      try {
        if (!ctx) build();
        await ctx.resume();
        enabled = true;
        fade(master.gain, 0.5, 1.6);
        bus.emit('audio.state', { on: true });
        bus.emit('achievement.unlock', { id: 'audio' });
        log.info('soundtrack on');
        return true;
      } catch (err) {
        log.error('could not start audio', err);
        return false;
      }
    },

    disable() {
      if (!enabled || !ctx) return;
      enabled = false;
      fade(master.gain, 0, 0.8);
      bus.emit('audio.state', { on: false });
      log.info('soundtrack off');
    },

    toggle() {
      return enabled ? (engine.disable(), false) : (engine.enable(), true);
    },

    /** 0 = ghibli bed, 1 = hacker bed. */
    setWorld(value) {
      worldMix = value;
      if (!ctx) return;
      fade(ghibliBus.gain, 1 - value, 1.4);
      fade(hackerBus.gain, value, 1.4);
    },

    /** A short UI click — only audible when the soundtrack is on. */
    blip(frequency = 880) {
      if (!enabled || !ctx) return;
      pluck(frequency, ctx.currentTime, master, { type: 'sine', peak: 0.06, decay: 0.12 });
    },

    isOn: () => enabled,

    stop() {
      clearInterval(scheduler);
      nodes.forEach((node) => { try { node.stop(); } catch { /* already stopped */ } });
      nodes = [];
      ctx?.close();
      ctx = null;
      enabled = false;
    },
  };

  return engine;
}
