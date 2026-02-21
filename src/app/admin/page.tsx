"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, type Participant, type Message, type Role } from "@/lib/supabase";
import { getUserId } from "@/lib/utils";

interface RoomConfig {
  admin_id: string | null;
}

interface EnrichedMessage extends Message {
  senderLabel: string;
}

export default function AdminPage() {
  const userId = typeof window !== "undefined" ? getUserId() : "";
  const [roomConfig, setRoomConfig] = useState<RoomConfig | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<EnrichedMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const isAuthorized = roomConfig?.admin_id && userId === roomConfig.admin_id;

  const loadData = useCallback(async () => {
    if (!userId) return;

    const [{ data: config }, { data: parts }, { data: msgs }] = await Promise.all([
      supabase.from("room_config").select("admin_id").eq("id", 1).single(),
      supabase.from("participants").select("*").order("joined_at", { ascending: true }),
      supabase.from("messages").select("*").order("created_at", { ascending: true }),
    ]);

    setRoomConfig({ admin_id: config?.admin_id ?? null });
    setParticipants((parts as Participant[]) || []);
    setMessages(enrichMessages((msgs as Message[]) || []));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const participantsChannel = supabase
      .channel("admin-participants")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "participants" },
        () => loadData()
      )
      .subscribe();

    const messagesChannel = supabase
      .channel("admin-messages")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => loadData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(participantsChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, [loadData]);

  if (!roomConfig && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading admin dashboard...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="text-lg font-medium text-black mb-2">Not authorized</p>
          <p className="text-sm text-gray-600">
            This page is only available to the Admin (the first user who joined).
          </p>
        </div>
      </div>
    );
  }

  const nonAdminCount = participants.filter((p) => p.role !== "admin").length;
  const speaker = participants.find((p) => p.role === "speaker");
  const listenerCount = participants.filter((p) => p.role === "listener").length;

  return (
    <div className="min-h-screen bg-white text-black px-6 py-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Admin Dashboard</h1>
      <p className="text-sm text-gray-600 mb-6">
        Observe all interactions in real time. Identities remain anonymous in the UI.
      </p>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Admin</p>
          <p className="text-lg font-medium">You</p>
        </div>
        <div className="rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Current Speaker</p>
          <p className="text-lg font-medium">
            {speaker ? "Active" : "None"}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Participants (Speaker + Listeners)</p>
          <p className="text-lg font-medium">
            {nonAdminCount} / 11
            <span className="text-xs text-gray-500 ml-1">
              ({listenerCount} listeners)
            </span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Participants list */}
        <div className="md:col-span-1">
          <h2 className="text-sm font-medium text-gray-800 mb-3">Participants</h2>
          <div className="rounded-xl border border-gray-200 p-3 max-h-[400px] overflow-y-auto">
            {participants.length === 0 && (
              <p className="text-sm text-gray-500">No one in the room yet.</p>
            )}
            {participants.map((p, index) => (
              <div
                key={p.id}
                className="flex items-center justify-between py-1.5 text-sm border-b border-gray-100 last:border-b-0"
              >
                <span className="text-gray-800">
                  {p.role === "admin"
                    ? "Admin (you)"
                    : p.role === "speaker"
                    ? "Speaker"
                    : `Listener #${index}`}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(p.joined_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Messages stream */}
        <div className="md:col-span-2">
          <h2 className="text-sm font-medium text-gray-800 mb-3">Messages</h2>
          <div className="rounded-xl border border-gray-200 p-3 max-h-[400px] overflow-y-auto space-y-3">
            {messages.length === 0 && (
              <p className="text-sm text-gray-500">No messages yet.</p>
            )}
            {messages.map((m) => (
              <div key={m.id} className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700">
                    {m.senderLabel}
                  </span>
                  <span className="text-[11px] text-gray-400">
                    {new Date(m.created_at).toLocaleTimeString()}
                  </span>
                </div>
                <div className="px-3 py-2 rounded-xl bg-gray-50 text-sm text-gray-900">
                  {m.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function enrichMessages(msgs: Message[]): EnrichedMessage[] {
  return msgs.map((m) => {
    let senderLabel: string;
    if (m.sender_role === "admin") senderLabel = "Admin";
    else if (m.sender_role === "speaker") senderLabel = "Speaker";
    else senderLabel = "Anonymous listener";
    return { ...m, senderLabel };
  });
}

