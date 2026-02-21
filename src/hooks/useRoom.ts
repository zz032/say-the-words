"use client";

import { useEffect, useState, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";
import { getUserId } from "@/lib/utils";
import { getCurrentPeriodStart } from "@/lib/utils";
import type { Participant, Role } from "@/lib/supabase";

const MAX_PARTICIPANTS = 11; // Speaker + Listeners (Admin does NOT count)

export type RoomStatus =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "full" }
  | { status: "left" }
  | {
      status: "joined";
      role: Role;
      participant: Participant;
      participantCount: number;
      // 如果用户当天已经发言过，标记为 true（用于 UI 提示与角色限制）
      hasSpokenToday?: boolean;
    };

export function useRoom() {
  const [roomStatus, setRoomStatus] = useState<RoomStatus>({ status: "loading" });
  const userId = typeof window !== "undefined" ? getUserId() : "";

  const joinRoom = useCallback(async () => {
    if (!userId) return;

    const supabase = getSupabase();
    if (!supabase) {
      setRoomStatus({ status: "error", message: "Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY." });
      return;
    }

    const [
      { data: participants, error: participantsError },
      { data: roomConfig, error: configError },
    ] = await Promise.all([
      supabase
        .from("participants")
        .select("*")
        .order("joined_at", { ascending: true }),
      supabase.from("room_config").select("admin_id").eq("id", 1).single(),
    ]);

    if (participantsError) {
      console.error("Failed to fetch participants:", participantsError);
      setRoomStatus({ status: "error", message: `Failed to fetch participants: ${participantsError.message ?? participantsError}` });
      return;
    }

    const adminId = roomConfig?.admin_id ?? null;

    // Current participant count excluding admin
    const participantCount = (participants ?? []).filter((p) =>
      ["speaker", "listener"].includes(p.role)
    ).length;

    // Returning user: restore their role, no duplicate
    const existing = participants?.find((p) => p.user_id === userId);
    if (existing) {
      setRoomStatus({
        status: "joined",
        role: existing.role as Role,
        participant: existing as Participant,
        participantCount,
      });
      return;
    }

    // Admin returning (invisible admin stored in room_config): do NOT insert into participants
    if (adminId && userId === adminId) {
      const fakeParticipant: Participant = {
        id: `admin-${userId}` as any,
        user_id: userId,
        role: "admin",
        joined_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      } as Participant;

      setRoomStatus({
        status: "joined",
        role: "admin",
        participant: fakeParticipant,
        participantCount,
      });
      return;
    }

    // New user: check capacity (Admin does NOT count)
    if (participantCount >= MAX_PARTICIPANTS) {
      setRoomStatus({ status: "full" });
      return;
    }

    // Determine whether the user has already spoken today.
    const periodStart = getCurrentPeriodStart();
    const { data: recentSpeakerMsgs } = await supabase
      .from("messages")
      .select("id")
      .eq("sender_user_id", userId)
      .eq("sender_role", "speaker")
      .gte("created_at", periodStart)
      .limit(1);
    const hasSpokenToday = (recentSpeakerMsgs && (recentSpeakerMsgs as any[]).length > 0) || false;

    // Assign role: first visitor => invisible admin (try to set atomically), second => speaker (unless user already spoke today), others => listener
    let role: Role | null = null;

    if (!adminId) {
      // Try to atomically set admin_id if still null
      const { data: updated, error: updateError } = await supabase
        .from("room_config")
        .update({ admin_id: userId, updated_at: new Date().toISOString() })
        .eq("id", 1)
        .is("admin_id", null)
        .select()
        .single();

      if (updateError && updateError.code !== "PGRST116") {
        // Log but proceed to re-read
        console.error("Failed conditional update for admin_id:", updateError);
      }

      // Re-fetch room_config.admin_id to see who became admin
      const { data: rc } = await supabase.from("room_config").select("admin_id").eq("id", 1).single();
      const finalAdmin = rc?.admin_id ?? null;
      if (finalAdmin === userId) {
        role = "admin";
        const fakeParticipant: Participant = {
          id: `admin-${userId}` as any,
          user_id: userId,
          role: "admin",
          joined_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        } as Participant;
        setRoomStatus({ status: "joined", role: "admin", participant: fakeParticipant, participantCount });
        return;
      }
      // If someone else became admin first, fall through to participant logic
    }

    // Determine speaker vs listener by current participant count
    if (participantCount === 0) {
      // If the user already spoke today, do NOT assign speaker again; make them a listener instead.
      role = hasSpokenToday ? "listener" : "speaker";
    } else role = "listener";

    // Insert participant (speaker or listener). Handle unique race by re-querying on conflict.
    const { data: newParticipant, error: insertError } = await supabase
      .from("participants")
      .insert({ user_id: userId, role, joined_at: new Date().toISOString() })
      .select()
      .single();

    if (insertError) {
      // If unique constraint on user_id happened (another tab inserted), try to fetch existing
      console.warn("Insert participant error, retrying fetch:", insertError);
      const { data: fetched } = await supabase.from("participants").select("*").eq("user_id", userId).single();
      if (fetched) {
        setRoomStatus({ status: "joined", role: fetched.role as Role, participant: fetched as Participant, participantCount: participantCount + 1, hasSpokenToday });
        return;
      }
      console.error("Failed to join room:", insertError);
      setRoomStatus({ status: "error", message: `Failed to join room: ${insertError.message ?? insertError}` });
      return;
    }

    setRoomStatus({ status: "joined", role: role as Role, participant: newParticipant as Participant, participantCount: participantCount + 1, hasSpokenToday });
  }, [userId]);

  useEffect(() => {
    joinRoom();
  }, [joinRoom]);

  // Subscribe to participant changes (speaker promotion, etc.)
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    const channel = supabase
      .channel("participants-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "participants" },
        () => joinRoom()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [joinRoom]);

  const leaveRoom = useCallback(async () => {
    if (!userId) return;

    const supabase = getSupabase();
    if (!supabase) return;

    const { data: participants } = await supabase
      .from("participants")
      .select("*")
      .order("joined_at", { ascending: true });

    const currentUser = participants?.find((p) => p.user_id === userId);
    // If the current user is the invisible admin (not in participants), clear room_config.admin_id
    const { data: roomConfig } = await supabase.from("room_config").select("admin_id").eq("id", 1).single();
    const adminId = roomConfig?.admin_id ?? null;

    if (adminId && userId === adminId) {
      await supabase
        .from("room_config")
        .update({ admin_id: null, updated_at: new Date().toISOString() })
        .eq("id", 1);
      setRoomStatus({ status: "left" });
      return;
    }

    // When Speaker leaves, promote next Listener to Speaker
    if (currentUser?.role === "speaker") {
      const listeners = participants?.filter((p) => p.role === "listener") ?? [];
      if (listeners.length > 0) {
        // Skip listeners who have already spoken today
        const periodStart = getCurrentPeriodStart();
        const listenerUserIds = listeners.map((l) => l.user_id);
        const { data: spoken } = await supabase
          .from("messages")
          .select("sender_user_id")
          .in("sender_user_id", listenerUserIds)
          .eq("sender_role", "speaker")
          .gte("created_at", periodStart);
        const spokenSet = new Set((spoken as any[] || []).map((s) => s.sender_user_id));

        const eligible = listeners.find((l) => !spokenSet.has(l.user_id));
        if (eligible) {
          await supabase.from("participants").update({ role: "speaker" }).eq("id", eligible.id);
        }
        // If none eligible, do not promote anyone this round
      }
    }

    // If the user exists in participants table, remove them. Otherwise nothing to delete.
    if (currentUser) {
      await supabase.from("participants").delete().eq("user_id", userId);
    }

    setRoomStatus({ status: "left" });
  }, [userId]);

  return { roomStatus, userId, leaveRoom, joinRoom };
}
