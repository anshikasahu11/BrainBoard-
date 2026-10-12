// BrainBoard's shared motion language. Change it here and it changes everywhere.

export const ease = {
  out: [0.22, 1, 0.36, 1], // quick start, long soft landing
  inOut: [0.65, 0, 0.35, 1], // for sweeps and transitions
};

export const durations = {
  fast: 0.18,
  base: 0.35,
  slow: 0.7,
};

// How much each motion level moves things.
// subtle: fade only. balanced: gentle rise. expressive: deeper, slower rise.
// baseDelay holds expressive content back so the entrance sweep can clear first.
export const levels = {
  subtle: { distance: 0, duration: 0.5, delayScale: 0.4, baseDelay: 0 },
  balanced: { distance: 16, duration: 0.8, delayScale: 1, baseDelay: 0 },
  expressive: { distance: 32, duration: 1.2, delayScale: 1.4, baseDelay: 0 },
};