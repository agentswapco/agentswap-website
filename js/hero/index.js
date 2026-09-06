/* Timed, readable permission walkthrough with pause, replay and manual exploration.
 * Exports: none; initializes the hero story and shared official-logo cursor state.
 * Dependencies: story.js and native visibility, media-query and timer APIs. */
// @ts-check
import { connectStory, renderStory } from './story.js';

/** @typedef {Navigator & {deviceMemory?:number, connection?:{saveData?:boolean}}} DeviceNavigator */
const device = /** @type {DeviceNavigator} */ (navigator);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const lowCapacity = (device.deviceMemory ?? 8) < 4 || (device.hardwareConcurrency || 8) < 4;
const surface = document.querySelector('#scene-surface');
const pause = document.querySelector('#motion-toggle');
const replay = document.querySelector('#journey-replay');
const STEP_DURATION_MS = 5200;
let stage = 0;
let paused = false;
let visible = true;
let timer = 0;

/** @returns {boolean} */
function allowsMotion() {
  return !reducedMotion.matches && !device.connection?.saveData && !lowCapacity;
}

/** @returns {void} */
function syncPlayback() {
  clearTimeout(timer);
  const playing = allowsMotion() && !paused && visible && !document.hidden;
  surface?.setAttribute('data-motion', playing ? 'playing' : 'static');
  document.body.setAttribute('data-motion', playing ? 'playing' : 'static');
  if (pause instanceof HTMLButtonElement) {
    pause.hidden = !allowsMotion();
    pause.textContent = paused ? 'Play motion' : 'Pause motion';
    pause.setAttribute('aria-pressed', String(paused));
  }
  if (playing) timer = window.setTimeout(advance, STEP_DURATION_MS);
}

/** @returns {void} */
function advance() {
  if (stage === 3) paused = true;
  else renderStory(++stage);
  syncPlayback();
}

/** @param {number} next @returns {void} */
function selectStage(next) {
  if (!Number.isInteger(next) || next < 0 || next > 3) return;
  stage = next;
  paused = true;
  renderStory(stage);
  syncPlayback();
}

/** @returns {void} */
function initialize() {
  if (!(surface instanceof HTMLElement) || !(pause instanceof HTMLButtonElement)) return;
  connectStory(selectStage);
  pause.addEventListener('click', () => {
    if (paused && stage === 3) { stage = 0; renderStory(stage); }
    paused = !paused;
    syncPlayback();
  });
  if (replay instanceof HTMLButtonElement) {
    replay.hidden = false;
    replay.addEventListener('click', () => { stage = 0; paused = false; renderStory(stage); syncPlayback(); });
  }
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; syncPlayback(); },
    { threshold: 0.15 }).observe(surface);
  document.addEventListener('visibilitychange', syncPlayback);
  reducedMotion.addEventListener('change', syncPlayback);
  renderStory(stage);
  syncPlayback();
}

initialize();
