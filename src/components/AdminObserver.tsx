"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase, supabase } from "@/lib/supabase";
import type { Participant, Message } from "@/lib/supabase";

export default function AdminObserver() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    const [{ data: parts }, { data: msgs }] = await Promise.all([
      sb.from("participants").select("*").order("joined_at", { ascending: true }),
      sb.from("messages").select("*").order("created_at", { ascending: true }),
    ]);
    setParticipants((parts as Participant[]) || []);
    setMessages((msgs as Message[]) || []);
    setLoading(false);
  }, []);

  const kickAll = useCallback(async () => {
    if (!confirm("Kick all participants (except admin)? This cannot be undone.")) return;
    const sb = getSupabase();
    if (!sb) return;

    // Export archive: collect messages and participants, compute counts
    try {
      const [{ data: parts }, { data: msgs }, { data: rc }] = await Promise.all([
        sb.from("participants").select("id,user_id,role,joined_at,created_at").order("joined_at", { ascending: true }),
        sb.from("messages").select("id,content,sender_role,sender_user_id,reply_to,created_at").order("created_at", { ascending: true }),
        sb.from("room_config").select("admin_id").eq("id", 1).single(),
      ]);

      const messages = (msgs as any[]) || [];
      const participantsArr = (parts as any[]) || [];

      // Total participants: distinct user_ids among participants and message senders (exclude admin)
      const userIdSet = new Set<string>();
      participantsArr.forEach((p) => {
        if (p && p.user_id) userIdSet.add(p.user_id);
      });
      messages.forEach((m) => {
        if (m && m.sender_user_id) userIdSet.add(m.sender_user_id);
      });
      const participantCount = userIdSet.size;

      // Speaker change count: number of distinct speaker user_ids seen in messages (minus 1)
      const speakerSet = new Set<string>();
      messages.forEach((m) => {
        if (m.sender_role === "speaker" && m.sender_user_id) speakerSet.add(m.sender_user_id);
      });
      const speakerChangeCount = Math.max(0, speakerSet.size - 1);

      // Insert archive record
      await sb.from("archives").insert({
        admin_user_id: rc?.admin_id ?? null,
        participant_count: participantCount,
        speaker_change_count: speakerChangeCount,
        participants: JSON.stringify(participantsArr),
        messages: JSON.stringify(messages),
      });
    } catch (err) {
      console.error("Failed to export archive:", err);
    }

    // Delete all participants (admin is not stored in participants, but keep safe check)
    await sb.from("participants").delete().neq("role", "admin");
    // Refresh data
    await load();
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const sb = supabase;
    if (!sb) return;

    const partsChannel = sb
      .channel("admin-observer-parts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "participants" },
        () => load()
      )
      .subscribe();

    const msgsChannel = sb
      .channel("admin-observer-msgs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => load()
      )
      .subscribe();

    return () => {
      sb.removeChannel(partsChannel);
      sb.removeChannel(msgsChannel);
    };
  }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading admin observer...</p>
      </div>
    );
  }

  const nonAdminCount = participants.filter((p) => p.role !== "admin").length;
  const speaker = participants.find((p) => p.role === "speaker");
  const listenerCount = participants.filter((p) => p.role === "listener").length;

  return (
    <div className="min-h-screen bg-white text-black px-6 py-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Admin Observer (godmode)</h1>
      <p className="text-sm text-gray-600 mb-6">
        You are observing as a godmode admin. You are not counted as a participant.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Mode</p>
          <p className="text-lg font-medium">Observer</p>
        </div>
        <div className="rounded-xl border border-gray-200 p-4 flex items-center justify-center">
          <button
            onClick={kickAll}
            className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition"
          >
            Kick All
          </button>
        </div>
        <div className="rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Current Speaker</p>
          <p className="text-lg font-medium">
            {speaker ? (speaker as any).display_name || "Active" : "None"}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Participants (Speaker + Listeners)</p>
          <p className="text-lg font-medium">
            {nonAdminCount} / 11
            <span className="text-xs text-gray-500 ml-1">({listenerCount} listeners)</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <h2 className="text-sm font-medium text-gray-800 mb-3">Participants</h2>
          <div className="rounded-xl border border-gray-200 p-3 max-h-[400px] overflow-y-auto">
            {participants.length === 0 && (
              <p className="text-sm text-gray-500">No one in the room yet.</p>
            )}
            {participants.map((p, index) => (
              <div key={p.id} className="flex items-center justify-between py-1.5 text-sm border-b border-gray-100 last:border-b-0">
                <span className="text-gray-800">
                  {p.role === "admin"
                    ? "Admin"
                    : p.role === "speaker"
                    ? `Speaker${(p as any).display_name ? ` (${(p as any).display_name})` : ""}`
                    : `Listener #${index}`}
                </span>
                <span className="text-xs text-gray-400">{new Date(p.joined_at).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-2">
          <h2 className="text-sm font-medium text-gray-800 mb-3">Messages</h2>
          <div className="rounded-xl border border-gray-200 p-3 max-h-[400px] overflow-y-auto space-y-3">
            {messages.length === 0 && (
              <p className="text-sm text-gray-500">No messages yet.</p>
            )}
            {messages.map((m) => (
              <div key={m.id} className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700">{m.sender_role === "listener" ? "Anonymous listener" : m.sender_role === "speaker" ? "Speaker" : "Admin"}</span>
                  <span className="text-[11px] text-gray-400">{new Date(m.created_at).toLocaleTimeString()}</span>
                </div>
                <div className="px-3 py-2 rounded-xl bg-gray-50 text-sm text-gray-900">{m.content}</div>
                {m.sender_role === "listener" && m.reply_to && (
                  <div className="px-3">
                    <span className="text-[11px] text-gray-500">
                      ↪ 引用: {(messages.find((x) => x.id === m.reply_to)?.content) || "未知消息"}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
