"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { useMessages } from "@/hooks/useMessages";

const SPEAKER_DAILY_LIMIT = 3;

interface SpeakerViewProps {
  role: "admin" | "speaker";
  onLeaveRoom: () => void;
  participantCount?: number;
  joinedAt?: string | null;
}

export function SpeakerView({ role, onLeaveRoom, participantCount, joinedAt }: SpeakerViewProps) {
  const {
    messages,
    speakerRemaining,
    sendMessage,
  } = useMessages(role, joinedAt);
  const [input, setInput] = useState("");

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || speakerRemaining <= 0) return;
    await sendMessage(trimmed);
    setInput("");
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto px-6 py-8">
      {/* Top */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-lg font-medium text-black">
            You are the {role === "admin" ? "Admin" : "Speaker"}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Remaining: {speakerRemaining} / {SPEAKER_DAILY_LIMIT}
          </p>
          <p className="text-sm text-gray-600 mt-1">Participants: {participantCount ?? 0} / 11</p>
          <p className="text-xs text-gray-500 mt-2 max-w-sm">
            You have 3 messages per day. Resets at 6:00 AM Beijing time.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {role !== "admin" ? (
            <button
              onClick={onLeaveRoom}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50 transition"
            >
              Leave Room
            </button>
          ) : (
            <button
              onClick={async () => {
                if (!confirm("Kick all participants (except admin)? This will archive the round and remove participants.")) return;
                const sb = getSupabase();
                if (!sb) return;
                try {
                  const [{ data: parts }, { data: msgs }, { data: rc }] = await Promise.all([
                    sb.from("participants").select("id,user_id,role,joined_at,created_at").order("joined_at", { ascending: true }),
                    sb.from("messages").select("id,content,sender_role,sender_user_id,reply_to,created_at").order("created_at", { ascending: true }),
                    sb.from("room_config").select("admin_id").eq("id", 1).single(),
                  ]);

                  const messages = (msgs as any[]) || [];
                  const participantsArr = (parts as any[]) || [];

                  const userIdSet = new Set<string>();
                  participantsArr.forEach((p) => { if (p && p.user_id) userIdSet.add(p.user_id); });
                  messages.forEach((m) => { if (m && m.sender_user_id) userIdSet.add(m.sender_user_id); });
                  const participantCountExport = userIdSet.size;

                  const speakerSet = new Set<string>();
                  messages.forEach((m) => { if (m.sender_role === "speaker" && m.sender_user_id) speakerSet.add(m.sender_user_id); });
                  const speakerChangeCount = Math.max(0, speakerSet.size - 1);

                  await sb.from("archives").insert({
                    admin_user_id: rc?.admin_id ?? null,
                    participant_count: participantCountExport,
                    speaker_change_count: speakerChangeCount,
                    participants: JSON.stringify(participantsArr),
                    messages: JSON.stringify(messages),
                  });
                } catch (err) {
                  console.error("Failed to export archive:", err);
                }

                await sb.from("participants").delete().neq("role", "admin");
                window.location.reload();
              }}
              className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition"
            >
              Kick All
            </button>
          )}
        </div>
      </div>

      {/* Chat history */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-6">
        {messages.length === 0 && (
          <p className="text-gray-500 text-sm">No messages yet.</p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.isSpeaker ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${
                msg.isSpeaker
                  ? "bg-black text-white rounded-br-md"
                  : "bg-gray-100 text-black rounded-bl-md"
              }`}
            >
              <p className="text-sm">{msg.content}</p>
              {msg.isSpeaker && typeof msg.replyCount === "number" && (
                <p className="text-xs text-gray-300 mt-1">Replies: {msg.replyCount}</p>
              )}
              {!msg.isSpeaker && (
                <p className="text-xs text-gray-500 mt-1">Anonymous reply</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a message..."
          disabled={speakerRemaining <= 0}
          className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:bg-gray-50 disabled:text-gray-400"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || speakerRemaining <= 0}
          className="px-5 py-3 rounded-xl bg-black text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition"
        >
          Send
        </button>
      </div>
    </div>
  );
}
