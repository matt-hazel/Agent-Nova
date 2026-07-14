"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { ChatPanelHandle } from "./ChatPanel";
import { isSpeaking } from "../../lib/voice";

export type VoiceStatus = {
  supported: boolean;
  listening: boolean;
  awake: boolean;
  micLevel: number;
  offline: boolean;
  fatalError: string | null;
};

export type VoiceListenerHandle = {
  stopListening: () => void;
  enableVoice: () => void;
};

export const INITIAL_VOICE_STATUS: VoiceStatus = {
  supported: true,
  listening: false,
  awake: false,
  micLevel: 0,
  offline: false,
  fatalError: null,
};

// the recognizer mangles "hey nova" constantly ("a nova", "hey noda", "hi
// nova"...), so match near-misses instead of one exact phrase
const WAKE_WORD_PATTERNS = [
  /\bhey\s+nov[ao]\b/,
  /\bhe['\s]?nov[ao]\b/,
  /\bhi\s+nov[ao]\b/,
  /\bhey\s+noda\b/,
  // Iron Man 2 homage: "Wake up, Daddy's home"
  /\bwake\s?up,?\s+daddy(?:'?s|\s+is)?\s+home\b/,
];
// pure safety net — VAD's onSpeechEnd below does the real end-of-speech
// detection, this just stops a command window hanging forever if VAD dies
const LISTEN_WINDOW_MS = 15000;
// small buffer after VAD says speech ended, so the recognizer's last
// "final" transcript has time to land before we cut things off
const VAD_END_GRACE_MS = 1000;
// how long to keep listening after Nova replies without needing the wake
// word again, so follow-ups feel like a conversation and not a re-invocation
const FOLLOWUP_WINDOW_MS = 9000;

function matchWakeWord(transcript: string): { index: number; length: number } | null {
  for (const pattern of WAKE_WORD_PATTERNS) {
    const match = pattern.exec(transcript);
    if (match) return { index: match.index, length: match[0].length };
  }
  return null;
}

// no built-in types for the Web Speech API, so here's just enough to get by
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: Event) => void) | null;
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

const VoiceListener = forwardRef<
  VoiceListenerHandle,
  { chatRef: React.RefObject<ChatPanelHandle | null>; onStatusChange?: (status: VoiceStatus) => void }
>(function VoiceListener({ chatRef, onStatusChange }, ref) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [awake, setAwake] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  // 0-1 live mic level from an AnalyserNode — makes the indicator react while
  // you're talking, before the recognizer's even transcribed anything
  const [micLevel, setMicLevel] = useState(0);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const awakeRef = useRef(false);
  // true during the post-response grace period, so the wake word isn't needed again
  const followupRef = useRef(false);
  // accumulates everything said after the wake word — the recognizer loves
  // to chop one sentence into several separate "final" results
  const commandBufferRef = useRef("");
  const listenWindowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vadEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const followupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const vadRef = useRef<import("@ricky0123/vad-web").MicVAD | null>(null);
  const levelRafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!getSpeechRecognitionCtor()) {
      setSupported(false);
    }
  }, []);

  // pushes status up to ChatPanel, which owns the actual indicator UI
  useEffect(() => {
    onStatusChange?.({ supported, listening, awake, micLevel, offline, fatalError });
  }, [supported, listening, awake, micLevel, offline, fatalError, onStatusChange]);

  useEffect(() => {
    return () => {
      if (levelRafRef.current) cancelAnimationFrame(levelRafRef.current);
      vadRef.current?.destroy();
      audioContextRef.current?.close();
      micStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function clearTimers() {
    if (listenWindowTimerRef.current) clearTimeout(listenWindowTimerRef.current);
    if (vadEndTimerRef.current) clearTimeout(vadEndTimerRef.current);
    if (followupTimerRef.current) clearTimeout(followupTimerRef.current);
    listenWindowTimerRef.current = null;
    vadEndTimerRef.current = null;
    followupTimerRef.current = null;
  }

  // just kills the recognizer — ChatPanel handles its own closing/clearing
  // and calls this via onShutdown when it hears "close nova" (typed or spoken)
  function stopListening() {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    recognition?.stop();
    if (levelRafRef.current) cancelAnimationFrame(levelRafRef.current);
    vadRef.current?.destroy();
    vadRef.current = null;
    audioContextRef.current?.close();
    audioContextRef.current = null;
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
    setMicLevel(0);
    setListening(false);
    setOffline(true);
  }

  useImperativeHandle(ref, () => ({ stopListening, enableVoice }));

  // opens the grace period after Nova replies, so the next thing you say
  // doesn't need "Hey Nova" in front of it
  function startFollowupWindow() {
    clearTimers();
    followupRef.current = true;
    awakeRef.current = true;
    setAwake(true);
    followupTimerRef.current = setTimeout(() => {
      followupRef.current = false;
      awakeRef.current = false;
      setAwake(false);
    }, FOLLOWUP_WINDOW_MS);
  }

  function endCommandWindow() {
    clearTimers();
    const command = commandBufferRef.current.trim();
    followupRef.current = false;
    awakeRef.current = false;
    setAwake(false);
    commandBufferRef.current = "";
    if (!command) return;
    chatRef.current?.open();
    chatRef.current
      ?.sendMessage(command, { speak: true })
      .then(startFollowupWindow);
  }

  function wakeUp(initialSpeech: string) {
    followupRef.current = false;
    awakeRef.current = true;
    setAwake(true);
    commandBufferRef.current = initialSpeech;
    clearTimers();
    // in case VAD never fires an end-of-speech event for whatever reason
    listenWindowTimerRef.current = setTimeout(endCommandWindow, LISTEN_WINDOW_MS);
  }

  function appendToCommand(speech: string) {
    if (!speech) return;
    // real speech during the follow-up window turns it into a proper
    // command window with the normal timers
    followupRef.current = false;
    commandBufferRef.current = commandBufferRef.current
      ? `${commandBufferRef.current} ${speech}`
      : speech;
    // VAD runs on its own mic stream and can fire onSpeechEnd out of sync
    // with the recognizer — a fresh transcript here proves the user's still
    // talking, so cancel any pending cutoff even if VAD thought they'd stopped
    if (vadEndTimerRef.current) {
      clearTimeout(vadEndTimerRef.current);
      vadEndTimerRef.current = null;
    }
  }

  // VAD's onSpeechEnd — the real "they stopped talking" signal
  function handleVadSpeechEnd() {
    if (!awakeRef.current) return;
    // this speech segment might've just been "hey nova" itself — people
    // pause after the wake word before saying the actual command. Don't cut
    // yet if nothing's been captured; wait for the recognizer to catch up
    if (!commandBufferRef.current.trim()) return;
    if (vadEndTimerRef.current) clearTimeout(vadEndTimerRef.current);
    vadEndTimerRef.current = setTimeout(endCommandWindow, VAD_END_GRACE_MS);
  }

  // VAD's onSpeechStart — they're still talking, so cancel any pending cutoff
  function handleVadSpeechStart() {
    if (vadEndTimerRef.current) {
      clearTimeout(vadEndTimerRef.current);
      vadEndTimerRef.current = null;
    }
  }

  async function startVadAndLevelMeter(stream: MediaStream) {
    const AudioContextCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    const audioContext = new AudioContextCtor();
    audioContextRef.current = audioContext;

    // separate volume meter for the indicator, decoupled from VAD's own frame cadence
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.6;
    source.connect(analyser);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    function tick() {
      analyser.getByteTimeDomainData(dataArray);
      let sumSquares = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const normalized = (dataArray[i] - 128) / 128;
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / dataArray.length);
      // speech rms rarely gets close to 1, so scale it up to actually use the indicator's range
      setMicLevel(Math.min(1, rms * 4));
      levelRafRef.current = requestAnimationFrame(tick);
    }
    tick();

    try {
      const { MicVAD } = await import("@ricky0123/vad-web");
      const vad = await MicVAD.new({
        audioContext,
        getStream: async () => stream,
        pauseStream: async () => {},
        resumeStream: async () => stream,
        baseAssetPath: "/vad/",
        onnxWASMBasePath: "/vad/",
        onSpeechStart: handleVadSpeechStart,
        onSpeechEnd: handleVadSpeechEnd,
      });
      vadRef.current = vad;
      vad.start();
    } catch (err) {
      // VAD's a nice-to-have — if the model/worklet fails to load, just
      // fall back to the LISTEN_WINDOW_MS timer
      console.warn("VAD unavailable, falling back to timer-based listening:", err);
    }
  }

  function enableVoice() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setSupported(false);
      return;
    }

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript.trim().toLowerCase();

        if (!awakeRef.current) {
          // ignore Nova's own voice bleeding back through the mic — she
          // still gets interrupted fine once she's done, since sendMessage
          // now waits for real playback to finish before reopening listening
          if (isSpeaking()) continue;
          const wakeMatch = matchWakeWord(transcript);
          if (!wakeMatch) continue;
          const rest = transcript.slice(wakeMatch.index + wakeMatch.length).trim();
          // wait for isFinal — interim results are too flaky to trust, and
          // waking up early on one that never resolves would leave us
          // stuck "awake" forever
          if (result.isFinal) {
            wakeUp(rest);
          }
        } else if (result.isFinal) {
          appendToCommand(transcript);
        }
      }
    };

    recognition.onerror = (event) => {
      const error = (event as unknown as { error?: string }).error;
      // "no-speech" / "aborted" happen constantly and fix themselves once
      // onend restarts things — but permission/device errors are dead ends
      if (error === "not-allowed" || error === "service-not-allowed") {
        setFatalError("Microphone access was denied or revoked.");
        setListening(false);
        recognitionRef.current = null;
      } else if (error === "audio-capture") {
        setFatalError("No microphone was found.");
        setListening(false);
        recognitionRef.current = null;
      }
    };

    recognition.onend = () => {
      // the browser stops "continuous" recognition on its own sometimes —
      // just restart it. awake state and the command buffer live outside
      // this object, so an in-progress command survives fine. Skip the
      // restart if a fatal error already cleared the ref above.
      if (recognitionRef.current !== recognition) return;
      try {
        recognition.start();
      } catch {
        // probably already running
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
    setFatalError(null);
    setOffline(false);
    setListening(true);

    // grab the mic for VAD + the level meter. SpeechRecognition manages its
    // own mic access with no way to share it, so this is a second
    // getUserMedia call — browsers dedupe it and won't prompt twice
    navigator.mediaDevices
      ?.getUserMedia({ audio: true })
      .then((stream) => {
        micStreamRef.current = stream;
        startVadAndLevelMeter(stream);
      })
      .catch((err) => {
        console.warn("Mic level meter / VAD unavailable:", err);
      });
  }

  // no UI here — ChatPanel renders the indicator from the status above
  return null;
});

export default VoiceListener;
