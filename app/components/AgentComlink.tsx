"use client";

import { useRef } from "react";
import ChatPanel, { type ChatPanelHandle } from "./ChatPanel";
import VoiceListener, { type VoiceListenerHandle } from "./VoiceListener";

export default function AgentComlink() {
  const chatRef = useRef<ChatPanelHandle>(null);
  const voiceRef = useRef<VoiceListenerHandle>(null);

  return (
    <>
      <VoiceListener ref={voiceRef} chatRef={chatRef} />
      <ChatPanel ref={chatRef} onShutdown={() => voiceRef.current?.stopListening()} />
    </>
  );
}
