"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import UiText from "./UiText";
import {
  pickDroidVoice,
  primeDroidVoice,
  DROID_VOICE_PITCH,
  DROID_VOICE_RATE,
  markSpeechStarted,
  markSpeechEnded,
} from "../../lib/voice";
import type { VoiceStatus } from "./VoiceListener";

type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatPanelHandle = {
  sendMessage: (text: string, opts?: { speak?: boolean }) => Promise<void>;
  open: () => void;
  close: () => void;
};

// resolves once actually done playing, not just queued — speak() returns
// immediately, so anything waiting on "is she done talking" needs this
function speakAloud(text: string): Promise<void> {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return Promise.resolve();
  }
  markSpeechStarted();
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickDroidVoice();
    if (voice) utterance.voice = voice;
    utterance.pitch = DROID_VOICE_PITCH;
    utterance.rate = DROID_VOICE_RATE;
    // treat errors as "done" too, otherwise a broken utterance wedges
    // the speaking flag on forever
    const finish = () => {
      markSpeechEnded();
      resolve();
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    window.speechSynthesis!.speak(utterance);
  });
}

// speaks sentence by sentence as text streams in, instead of waiting for
// the whole reply — chains playback so finish() only resolves once every
// sentence has actually played
function createSpeechQueue() {
  let buffer = "";
  let playbackChain: Promise<void> = Promise.resolve();

  function flushSentences(final: boolean) {
    const pattern = /[^.!?]*[.!?]+[\s]*/g;
    let match: RegExpExecArray | null;
    let consumed = 0;
    while ((match = pattern.exec(buffer))) {
      const sentence = match[0].trim();
      if (sentence) {
        playbackChain = playbackChain.then(() => speakAloud(sentence));
      }
      consumed = pattern.lastIndex;
    }
    buffer = buffer.slice(consumed);
    if (final && buffer.trim()) {
      const sentence = buffer.trim();
      playbackChain = playbackChain.then(() => speakAloud(sentence));
      buffer = "";
    }
  }

  return {
    push(chunk: string) {
      buffer += chunk;
      flushSentences(false);
    },
    // resolves once everything queued has actually played — that's the
    // "safe to start listening again" signal
    async finish(): Promise<void> {
      flushSentences(true);
      await playbackChain;
    },
  };
}

// "clear the chat" / "clear comlink" etc — handled locally since the
// model has no way to clear the panel itself
const CLEAR_CHAT_PATTERN =
  /^(?:please\s+)?clear(?:\s+(?:the|this))?\s+(?:chat|comlink|conversation|messages?)\.?$/i;

function isClearChatCommand(text: string): boolean {
  return CLEAR_CHAT_PATTERN.test(text.trim());
}

// same deal for "close nova" / "shut down nova" / "power off" etc
const SHUTDOWN_PATTERN =
  /^(?:please\s+)?(?:close|shut ?down|turn off|power off|power down)(?:\s+nova)?\.?$/i;

function isShutdownCommand(text: string): boolean {
  return SHUTDOWN_PATTERN.test(text.trim());
}

// sits in the chat header strip so it's visible whenever you're actually
// looking at the chat, not buried in the app header
function VoiceIndicator({
  status,
  onEnableVoice,
}: {
  status: VoiceStatus;
  onEnableVoice?: () => void;
}) {
  if (!status.supported) {
    return (
      <span className="voice-status voice-unsupported">
        <UiText>Voice unsupported</UiText>
      </span>
    );
  }

  if (!status.listening) {
    return (
      <button
        type="button"
        className={`voice-enable ${status.offline ? "voice-offline" : ""}`}
        onClick={onEnableVoice}
        title={status.fatalError ?? undefined}
      >
        <UiText>
          {status.fatalError
            ? "Retry Voice"
            : status.offline
            ? "Nova Offline — Restart"
            : "Enable Voice"}
        </UiText>
      </button>
    );
  }

  return (
    <span
      className={`status-dot voice-indicator ${status.awake ? "voice-awake" : ""} ${
        status.micLevel > 0.05 ? "voice-hearing" : ""
      }`}
      style={
        {
          "--status-color": status.awake ? "#ffb000" : "#5ad7ff",
          "--mic-level": status.micLevel,
          transform: `scale(${1 + status.micLevel * 0.6})`,
          boxShadow:
            status.micLevel > 0.05
              ? `0 0 ${4 + status.micLevel * 16}px var(--status-color)`
              : undefined,
        } as React.CSSProperties
      }
      title="Listening for &quot;Hey Nova&quot;"
    />
  );
}

type ChatPanelProps = {
  onShutdown?: () => void;
  voiceStatus?: VoiceStatus;
  onEnableVoice?: () => void;
};

const ChatPanel = forwardRef<ChatPanelHandle, ChatPanelProps>(
  function ChatPanel({ onShutdown, voiceStatus, onEnableVoice }, ref) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;
  // one conversation per browser, kept forever so history stays searchable —
  // "Clear" below only wipes the visible messages, never this
  const conversationIdRef = useRef<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    primeDroidVoice();
    const CONVERSATION_ID_KEY = "nova:conversationId";
    const existing = localStorage.getItem(CONVERSATION_ID_KEY);
    if (existing) {
      conversationIdRef.current = existing;
    } else {
      const id = crypto.randomUUID();
      localStorage.setItem(CONVERSATION_ID_KEY, id);
      conversationIdRef.current = id;
    }
  }, []);

  // auto-scroll to the newest message, including while a reply is still streaming in
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const clearChat = useCallback((opts?: { speak?: boolean }) => {
    setMessages([]);
    setError(null);
    if (opts?.speak) speakAloud("Chat cleared.");
  }, []);

  const shutDown = useCallback(
    (opts?: { speak?: boolean }) => {
      setIsOpen(false);
      setMessages([]);
      setError(null);
      if (opts?.speak) speakAloud("Nova offline.");
      onShutdown?.();
    },
    [onShutdown]
  );

  const sendMessage = useCallback(
    async (text: string, opts?: { speak?: boolean }) => {
      if (!text.trim() || sending) return;
      if (isClearChatCommand(text)) {
        clearChat(opts);
        return;
      }
      if (isShutdownCommand(text)) {
        shutDown(opts);
        return;
      }
      setError(null);
      const nextMessages: ChatMessage[] = [
        ...messagesRef.current,
        { role: "user", content: text },
      ];
      setMessages(nextMessages);
      setSending(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: nextMessages,
            conversationId: conversationIdRef.current,
          }),
        });
        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? "Chat request failed");
        }

        const speechQueue = opts?.speak ? createSpeechQueue() : null;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let reply = "";
        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          reply += chunk;
          speechQueue?.push(chunk);
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: "assistant", content: reply };
            return updated;
          });
        }
        // text's done, so drop the "..." — but don't resolve the promise
        // until she's actually finished talking (VoiceListener waits on this
        // before it starts listening again)
        setSending(false);
        await speechQueue?.finish();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Chat request failed");
        setSending(false);
      }
    },
    [sending, clearChat, shutDown]
  );

  useImperativeHandle(ref, () => ({
    sendMessage,
    open: () => setIsOpen(true),
    close: () => {
      setIsOpen(false);
      setMessages([]);
      setError(null);
    },
  }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input;
    setInput("");
    await sendMessage(text);
  }

    return (
      <>
        <button
          type="button"
          className="chat-toggle"
          onClick={() => setIsOpen((v) => !v)}
          aria-label="Toggle chat panel"
        >
          <UiText>{isOpen ? "Close Comlink" : "Comlink"}</UiText>
        </button>
        {isOpen && (
          <aside className="chat-panel">
            <div className="console-strip">
              <span className="console-label">
                <UiText>Agent Comlink</UiText>
              </span>
              <span className="chat-strip-right">
                {voiceStatus && (
                  <VoiceIndicator status={voiceStatus} onEnableVoice={onEnableVoice} />
                )}
                <span className="console-telemetry">
                  {String(messages.length).padStart(2, "0")} MSG
                </span>
                <button
                  type="button"
                  className="chat-clear"
                  onClick={() => clearChat()}
                  disabled={messages.length === 0}
                  aria-label="Clear chat"
                  title="Clear chat"
                >
                  <UiText>Clear</UiText>
                </button>
                <button
                  type="button"
                  className="chat-close"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close chat panel"
                >
                  ×
                </button>
              </span>
            </div>
            <div className="chat-messages">
              {messages.length === 0 && (
                <p className="empty-state">
                  <UiText>Ask about your projects, or tell me to make changes.</UiText>
                </p>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`chat-bubble chat-bubble-${m.role}`}>
                  {m.content}
                </div>
              ))}
              {sending && (
                <div className="chat-bubble chat-bubble-assistant chat-pending">
                  <UiText>...</UiText>
                </div>
              )}
              {error && <p className="chat-error">{error}</p>}
              <div ref={messagesEndRef} />
            </div>
            <form className="chat-input-row" onSubmit={handleSubmit}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Message"
                disabled={sending}
              />
              <button type="submit" disabled={sending || !input.trim()}>
                <UiText>Send</UiText>
              </button>
            </form>
          </aside>
      )}
    </>
  );
});

export default ChatPanel;
