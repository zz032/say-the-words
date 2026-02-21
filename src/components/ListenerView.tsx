"use client";

import { useEffect, useState } from "react";
import { useMessages } from "@/hooks/useMessages";
import { getSupabase } from "@/lib/supabase";

interface ListenerViewProps {
  onLeaveRoom?: () => void;
  participantCount?: number;
  joinedAt?: string | null;
  hasSpokenToday?: boolean;
}

export function ListenerView({ onLeaveRoom, participantCount, joinedAt, hasSpokenToday }: ListenerViewProps) {
  const { messages, listenerHasReplied, sendMessage } = useMessages("listener", joinedAt);
  const [input, setInput] = useState("");
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [speakerName, setSpeakerName] = useState<string | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    const load = async () => {
      const { data } = await sb.from("participants").select("display_name, role").eq("role", "speaker").limit(1);
      const n = (data as any[])?.[0]?.display_name ?? null;
      setSpeakerName(n);
    };
    load();
    const channel = sb
      .channel("listener-speaker-name")
      .on("postgres_changes", { event: "*", schema: "public", table: "participants" }, () => load())
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, []);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (!replyToId) return;
    if (sending) return;
    setSending(true);
    await sendMessage(trimmed, replyToId);
    setSending(false);
    setInput("");
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto px-6 py-8">
      {/* Top */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-lg font-medium text-black">You are listening</p>
          <p className="text-xs text-gray-500 mt-2 max-w-sm">
            You can send one anonymous reply. Only the Speaker will see it.
          </p>
          <p className="text-sm text-gray-800 mt-2">Speaker: {speakerName ?? "Active"}</p>
          {hasSpokenToday && (
            <p className="text-sm text-red-600 mt-2">您今天已经发言过，请等待其余发言者。</p>
          )}
        </div>
        {onLeaveRoom && (
          <button
            onClick={onLeaveRoom}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50 transition"
          >
            Leave Room
          </button>
        )}
        <div className="ml-4 text-sm text-gray-600">Participants: {participantCount ?? 0} / 11</div>
      </div>

      {/* Speaker message history only */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-6">
        {messages.length === 0 && (
          <p className="text-gray-500 text-sm">No messages from the Speaker yet.</p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="mb-3">
            <div className="flex justify-start">
              <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-bl-md bg-gray-100 text-black">
                <p className="text-sm">{msg.content}</p>
                {typeof msg.replyCount === "number" && (
                  <p className="text-xs text-gray-500 mt-1">Replies: {msg.replyCount}</p>
                )}
                <div className="mt-2">
                  <button
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => setReplyToId(msg.id)}
                  >
                    回复此消息
                  </button>
                </div>
              </div>
            </div>

            {msg.myReplyContent && (
              <div className="flex justify-end mt-2">
                <div className="max-w-[70%] px-3 py-2 rounded-2xl bg-black text-white text-sm">
                  {msg.myReplyContent}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2">
          {messages.filter((m) => m.isSpeaker).length === 0 ? (
            <p className="text-sm text-gray-500 py-2">等待发言者发言后才能回复。</p>
          ) : (
            <>
              {replyToId && messages.find((m) => m.id === replyToId)?.myReplyContent ? (
                <p className="text-sm text-gray-500 py-2">You have completed your reply for this message.</p>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type your reply..."
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || !replyToId || sending}
                    className="px-5 py-3 rounded-xl bg-black text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition"
                  >
                    Send
                  </button>
                </div>
              )}
            </>
          )}
          {replyToId && (
            <div className="text-xs text-gray-500">
              正在回复：
              <span className="text-gray-700">
                {messages.find((m) => m.id === replyToId)?.content ?? ""}
              </span>
              <button
                className="ml-2 text-blue-600 hover:underline"
                onClick={() => setReplyToId(null)}
              >
                取消引用
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
