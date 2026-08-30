"use client";

import { FloorMaterial } from "../world/grid";

type Ambience = "aisle" | "hvac" | "hum" | "sublevel" | "office";

/**
 * A small synthesized-audio engine: an ambience bed, footsteps, and light-relay clicks,
 * all generated with the Web Audio API rather than sample playback, so the game ships
 * with no external audio assets. See design-plan §9.
 */
export class AudioEngine {
  private ctx: AudioContext;
  private master: GainNode;
  private ambienceGain: GainNode;
  private noiseSource: AudioBufferSourceNode | null = null;
  private buzzOsc: OscillatorNode | null = null;
  private buzzGain: GainNode | null = null;
  private hvacFilter: BiquadFilterNode | null = null;
  private lastFootstepAt = 0;

  constructor(volume: number) {
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = volume;
    this.master.connect(this.ctx.destination);
    this.ambienceGain = this.ctx.createGain();
    this.ambienceGain.gain.value = 0.5;
    this.ambienceGain.connect(this.master);
  }

  setVolume(volume: number): void {
    this.master.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.1);
  }

  private noiseBuffer(): AudioBuffer {
    const length = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  startAmbience(zone: Ambience): void {
    this.stopAmbience();

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer();
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = zone === "hvac" ? 900 : zone === "sublevel" ? 300 : 500;
    filter.Q.value = 0.7;
    this.hvacFilter = filter;

    const gain = this.ctx.createGain();
    gain.gain.value = zone === "hvac" ? 0.35 : zone === "sublevel" ? 0.22 : 0.14;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambienceGain);
    noise.start();
    this.noiseSource = noise;

    // 120 Hz fluorescent/transformer buzz, amplitude driven by nearby lit sectors.
    const buzz = this.ctx.createOscillator();
    buzz.type = "sine";
    buzz.frequency.value = zone === "sublevel" ? 50 : 120;
    const buzzGain = this.ctx.createGain();
    buzzGain.gain.value = 0;
    buzz.connect(buzzGain);
    buzzGain.connect(this.ambienceGain);
    buzz.start();
    this.buzzOsc = buzz;
    this.buzzGain = buzzGain;
  }

  /** Called every frame with 0..1: how much of the nearby light sectors are lit. */
  setBuzzIntensity(intensity: number): void {
    this.buzzGain?.gain.setTargetAtTime(intensity * 0.02, this.ctx.currentTime, 0.2);
  }

  stopAmbience(): void {
    this.noiseSource?.stop();
    this.noiseSource = null;
    this.buzzOsc?.stop();
    this.buzzOsc = null;
    this.buzzGain = null;
  }

  /** A short click as a relay engages when a light sector wakes or fades. */
  playRelayClick(): void {
    const osc = this.ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = 900;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.06);
  }

  /** Distance-walked-driven footstep cadence; call every frame with meters moved this frame. */
  tickFootsteps(distanceMoved: number, floor: FloorMaterial): void {
    this.lastFootstepAt += distanceMoved;
    const stride = 0.75;
    if (this.lastFootstepAt < stride) return;
    this.lastFootstepAt = 0;
    this.playFootstep(floor);
  }

  private playFootstep(floor: FloorMaterial): void {
    const length = Math.floor(this.ctx.sampleRate * 0.12);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const env = 1 - i / length;
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = 0.9 + Math.random() * 0.2;

    const filter = this.ctx.createBiquadFilter();
    filter.type = floor === FloorMaterial.Carpet ? "lowpass" : "bandpass";
    filter.frequency.value = floor === FloorMaterial.Carpet ? 500 : floor === FloorMaterial.Wet ? 1800 : 1200;

    const gain = this.ctx.createGain();
    gain.gain.value = floor === FloorMaterial.Carpet ? 0.12 : 0.2;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
  }

  dispose(): void {
    this.stopAmbience();
    this.ctx.close();
  }
}
