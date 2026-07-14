"use client";

import { useRef, useState } from "react";
import ChatPanel, { type ChatPanelHandle } from "./ChatPanel";
import VoiceListener, {
  type VoiceListenerHandle,
  type VoiceStatus,
  INITIAL_VOICE_STATUS,
} from "./VoiceListener";

export default function AgentComlink() {
  const chatRef = useRef<ChatPanelHandle>(null);
  const voiceRef = useRef<VoiceListenerHandle>(null);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>(INITIAL_VOICE_STATUS);

  return (
    <>
      <VoiceListener ref={voiceRef} chatRef={chatRef} onStatusChange={setVoiceStatus} />
      <ChatPanel
        ref={chatRef}
        voiceStatus={voiceStatus}
        onEnableVoice={() => voiceRef.current?.enableVoice()}
        onShutdown={() => voiceRef.current?.stopListening()}
      />
    </>
  );
}
