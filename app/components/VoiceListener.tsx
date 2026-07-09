"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { ChatPanelHandle } from "./ChatPanel";
import UiText from "./UiText";

export type VoiceListenerHandle = {
  stopListening: () => void;
};

const WAKE_WORD = "hey nova";
// How long to keep listening after the wake word before giving up if the
// user hasn't said anything yet.
const LISTEN_WINDOW_MS = 10000;
// How long to wait after the last bit of speech before treating the
// command as finished and sending it — mirrors how Alexa/Google Home wait
// for a pause rather than requiring everything in one recognizer "final".
const SILENCE_TIMEOUT_MS = 1500;

// TS doesn't ship types for the Web Speech API out of the box, so here's
// just enough of the shape to make this file happy
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

const VoiceListener = forwardRef<VoiceListenerHandle, { chatRef: React.RefObject<ChatPanelHandle | null> }>(
  function VoiceListener({ chatRef }, ref) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [awake, setAwake] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const awakeRef = useRef(false);
  // this just piles up everything said after the wake word, since the
  // recognizer likes to chop it into a bunch of separate "final" results
  const commandBufferRef = useRef("");
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listenWindowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!getSpeechRecognitionCtor()) {
      setSupported(false);
    }
  }, []);

  function clearTimers() {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (listenWindowTimerRef.current) clearTimeout(listenWindowTimerRef.current);
    silenceTimerRef.current = null;
    listenWindowTimerRef.current = null;
  }

  // just kills the recognizer, doesn't touch the chat panel itself —
  // ChatPanel handles closing/clearing on its own and calls this through
  // onShutdown once it hears something like "close nova" (typed or spoken)
  function stopListening() {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    recognition?.stop();
    setListening(false);
    setOffline(true);
  }

  useImperativeHandle(ref, () => ({ stopListening }));

  function endCommandWindow() {
    clearTimers();
    const command = commandBufferRef.current.trim();
    awakeRef.current = false;
    setAwake(false);
    commandBufferRef.current = "";
    if (!command) return;
    chatRef.current?.open();
    chatRef.current?.sendMessage(command, { speak: true });
  }

  function wakeUp(initialSpeech: string) {
    awakeRef.current = true;
    setAwake(true);
    commandBufferRef.current = initialSpeech;
    clearTimers();
    // bail out if they said the wake word and then just... nothing
    listenWindowTimerRef.current = setTimeout(endCommandWindow, LISTEN_WINDOW_MS);
    if (initialSpeech) {
      silenceTimerRef.current = setTimeout(endCommandWindow, SILENCE_TIMEOUT_MS);
    }
  }

  function appendToCommand(speech: string) {
    if (!speech) return;
    commandBufferRef.current = commandBufferRef.current
      ? `${commandBufferRef.current} ${speech}`
      : speech;
    // more speech came in, so push the "are they done yet" timer back out
    // again — basically copying how Alexa/Google Home wait for a pause
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(endCommandWindow, SILENCE_TIMEOUT_MS);
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
          const wakeIndex = transcript.indexOf(WAKE_WORD);
          if (wakeIndex === -1) continue;
          const rest = transcript.slice(wakeIndex + WAKE_WORD.length).trim();
          // only open the listening window once this bit is final —
          // interim results are too flaky to trust, and if we set awakeRef
          // early and it never resolves (recognizer restarts mid-phrase,
          // whatever) we'd get stuck "awake" forever
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
      // "no-speech" and "aborted" happen all the time and fix themselves
      // once onend restarts things. permission/device errors are dead
      // ends though — no point silently retrying forever
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
      // browser stops "continuous" recognition on its own sometimes
      // (silence timeout, whatever), so just start it back up. awake
      // state and the buffered command live outside this object so an
      // in-progress command survives the restart just fine. skip the
      // restart if we hit a fatal error above (ref got cleared)
      if (recognitionRef.current !== recognition) return;
      try {
        recognition.start();
      } catch {
        // probably already running, whatever
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
    setFatalError(null);
    setOffline(false);
    setListening(true);
  }

  if (!supported) {
    return (
      <div className="voice-status voice-unsupported">
        <UiText>Voice not supported in this browser</UiText>
      </div>
    );
  }

  return (
    <div className="voice-status">
      {listening ? (
        <span
          className={`status-dot voice-indicator ${awake ? "voice-awake" : ""}`}
          style={{ "--status-color": awake ? "#ffb000" : "#5ad7ff" } as React.CSSProperties}
          title="Listening for &quot;Hey Nova&quot;"
        />
      ) : (
        <button
          type="button"
          className={`voice-enable ${offline ? "voice-offline" : ""}`}
          onClick={enableVoice}
          title={fatalError ?? undefined}
        >
          <UiText>
            {fatalError ? "Retry Voice" : offline ? "Nova Offline — Restart" : "Enable Voice"}
          </UiText>
        </button>
      )}
      {fatalError && <span className="voice-error">{fatalError}</span>}
    </div>
  );
  }
);

export default VoiceListener;
