// picks the closest system voice to a deep protocol-droid tone (C-3PO, but
// lower) and tunes pitch/rate to push it further that way. The Web Speech
// API can only pick an OS-installed voice, not synthesize a new one, so
// this is a best-effort match, not a real clone.

const PREFERRED_VOICE_NAMES = [
  "daniel",
  "arthur",
  "oliver",
  "google uk english male",
  "microsoft ryan",
  "microsoft guy",
  "alex",
];

let cachedVoice: SpeechSynthesisVoice | null | undefined;

function scoreVoice(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase();
  let score = 0;

  const preferredIndex = PREFERRED_VOICE_NAMES.findIndex((n) => name.includes(n));
  if (preferredIndex !== -1) {
    score += (PREFERRED_VOICE_NAMES.length - preferredIndex) * 10;
  }

  // British English reads closer to protocol-droid diction than en-US defaults
  if (voice.lang === "en-GB") score += 3;
  if (voice.lang.startsWith("en")) score += 1;

  // "male" voices skew deeper without needing to pitch-shift into robotic territory
  if (name.includes("male") && !name.includes("female")) score += 2;

  if (voice.localService) score += 1;

  return score;
}

export function pickDroidVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  if (cachedVoice !== undefined) return cachedVoice;

  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  const best = voices.reduce<SpeechSynthesisVoice | null>((acc, voice) => {
    if (!acc) return voice;
    return scoreVoice(voice) > scoreVoice(acc) ? voice : acc;
  }, null);

  cachedVoice = best;
  return best;
}

// most browsers load voice lists asynchronously — call this once up top so
// the first pickDroidVoice() after they arrive doesn't hit a stale empty cache
export function primeDroidVoice() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  cachedVoice = undefined;
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = undefined;
    pickDroidVoice();
  };
}

// deeper pitch, more deliberate rate — reads more like a protocol droid
// than the flat default most TTS voices ship with
export const DROID_VOICE_PITCH = 0.7;
export const DROID_VOICE_RATE = 0.95;

// lets VoiceListener know Nova's actually talking, so it can ignore mic
// input as a wake word/command until she's done — otherwise you'd have to
// talk over her. Counter instead of a boolean since sentences can queue up
// faster than they play; stays "speaking" until every one finishes.
let speakingCount = 0;

export function markSpeechStarted() {
  speakingCount += 1;
}

export function markSpeechEnded() {
  speakingCount = Math.max(0, speakingCount - 1);
}

export function isSpeaking(): boolean {
  return speakingCount > 0;
}
