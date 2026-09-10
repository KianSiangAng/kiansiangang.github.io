/* ================================================================
   SYNTH.JS — A generated soundtrack, no audio files

   A slow ambient pad: three detuned triangle oscillators on a
   suspended chord through a lowpass filter whose cutoff is swept by
   an LFO, plus sparse bell notes picked from a pentatonic scale.
   Vaguely Joe Hisaishi, if you are feeling generous.

   Notes are queued by a lookahead scheduler rather than a
   setTimeout per note: setTimeout jitter is audible on anything
   rhythmic, and a lookahead clock is the standard fix.

   Reverb is a convolver fed a procedurally generated impulse
   response (exponentially decaying noise) — no .wav to download.

   Off by default. Nothing is created until a visitor explicitly
   turns it on, which also satisfies browser autoplay policy.
================================================================ */

import { createLogger } from '../core/logger.js';

const log = createLogger('audio');

/* A minor pentatonic: no interval in it can sound wrong against
   the pad, which is what makes randomly chosen bell notes safe. */
const PENTATONIC = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33];

export function createAudioEngine({ bus }) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    log.warn('Web Audio unavailable — the soundtrack is disabled');
    return { supported: false, enable() {}, disable() {}, toggle() {}, blip() {}, isOn: () => false };
  }

  let ctx = null;
  let master = null;
  let padBus = null;
  let nodes = [];
  let scheduler = 0;
  let nextNoteTime = 0;
  let step = 0;
  let enabled = false;

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

    padBus = ctx.createGain();
    padBus.gain.value = 1;
    padBus.connect(master);

    buildPad();

    nextNoteTime = ctx.currentTime;
    scheduler = setInterval(tick, TICK);
  }

  function buildPad() {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.7;
    filter.connect(padBus);

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
      // Bells: sparse, on the beat, and only sometimes, so the pad
      // never turns into a melody that demands attention.
      if (step % 8 === 0 && Math.random() < 0.55) {
        pluck(PENTATONIC[(Math.random() * PENTATONIC.length) | 0], nextNoteTime, padBus, {
          type: 'sine',
          peak: 0.1,
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
