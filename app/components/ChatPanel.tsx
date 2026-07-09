"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import UiText from "./UiText";

type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatPanelHandle = {
  sendMessage: (text: string, opts?: { speak?: boolean }) => Promise<void>;
  open: () => void;
  close: () => void;
};

function speakAloud(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

// catches stuff like "clear the chat", "clear chat", "clear this
// conversation", "clear comlink" — we handle this ourselves instead of
// sending it to the API, since the model obviously can't clear the panel
const CLEAR_CHAT_PATTERN =
  /^(?:please\s+)?clear(?:\s+(?:the|this))?\s+(?:chat|comlink|conversation|messages?)\.?$/i;

function isClearChatCommand(text: string): boolean {
  return CLEAR_CHAT_PATTERN.test(text.trim());
}

// same idea as clear-chat — "close nova", "shut down nova", "power off",
// "turn off nova" etc all get handled here instead of going to the API
const SHUTDOWN_PATTERN =
  /^(?:please\s+)?(?:close|shut ?down|turn off|power off|power down)(?:\s+nova)?\.?$/i;

function isShutdownCommand(text: string): boolean {
  return SHUTDOWN_PATTERN.test(text.trim());
}

const ChatPanel = forwardRef<ChatPanelHandle, { onShutdown?: () => void }>(
  function ChatPanel({ onShutdown }, ref) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

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
          body: JSON.stringify({ messages: nextMessages }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "Chat request failed");
        }
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
        if (opts?.speak) speakAloud(data.reply);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Chat request failed");
      } finally {
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
