"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { getUserId } from "@/lib/utils";
import type { Participant, Role } from "@/lib/supabase";

const MAX_PARTICIPANTS = 11; // Speaker + Listeners (Admin does NOT count)

export type RoomStatus =
  | { status: "loading" }
  | { status: "full" }
  | { status: "left" }
  | { status: "joined"; role: Role; participant: Participant };

export function useRoom() {
  const [roomStatus, setRoomStatus] = useState<RoomStatus>({ status: "loading" });
  const userId = typeof window !== "undefined" ? getUserId() : "";

  const joinRoom = useCallback(async () => {
    if (!userId) return;

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
      setRoomStatus({ status: "loading" });
      return;
    }

    const adminId = roomConfig?.admin_id ?? null;

    // Returning user: restore their role, no duplicate
    const existing = participants?.find((p) => p.user_id === userId);
    if (existing) {
      setRoomStatus({
        status: "joined",
        role: existing.role as Role,
        participant: existing as Participant,
      });
      return;
    }

    // Admin returning (was in room, left, coming back): always assign ADMIN
    if (adminId && userId === adminId) {
      const { data: newParticipant, error: insertError } = await supabase
        .from("participants")
        .insert({
          user_id: userId,
          role: "admin",
          joined_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (!insertError) {
        setRoomStatus({
          status: "joined",
          role: "admin",
          participant: newParticipant as Participant,
        });
      }
      return;
    }

    // New user: check capacity (Admin does NOT count)
    const participantCount = (participants ?? []).filter((p) =>
      ["speaker", "listener"].includes(p.role)
    ).length;

    if (participantCount >= MAX_PARTICIPANTS) {
      setRoomStatus({ status: "full" });
      return;
    }

    // Assign role: first user = ADMIN, second = SPEAKER, rest = LISTENER
    let role: Role;
    if (!adminId) {
      role = "admin";
    } else if (participantCount === 0) {
      role = "speaker";
    } else {
      role = "listener";
    }

    const { data: newParticipant, error: insertError } = await supabase
      .from("participants")
      .insert({
        user_id: userId,
        role,
        joined_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to join room:", insertError);
      setRoomStatus({ status: "loading" });
      return;
    }

    // First user (admin): store adminId in room_config
    if (role === "admin") {
      await supabase
        .from("room_config")
        .update({ admin_id: userId, updated_at: new Date().toISOString() })
        .eq("id", 1);
    }

    setRoomStatus({
      status: "joined",
      role,
      participant: newParticipant as Participant,
    });
  }, [userId]);

  useEffect(() => {
    joinRoom();
  }, [joinRoom]);

  // Subscribe to participant changes (speaker promotion, etc.)
  useEffect(() => {
    const channel = supabase
      .channel("participants-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "participants" },
        () => joinRoom()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [joinRoom]);

  const leaveRoom = useCallback(async () => {
    if (!userId) return;

    const { data: participants } = await supabase
      .from("participants")
      .select("*")
      .order("joined_at", { ascending: true });

    const currentUser = participants?.find((p) => p.user_id === userId);

    // When Speaker leaves, promote next Listener to Speaker
    if (currentUser?.role === "speaker") {
      const listeners = participants?.filter((p) => p.role === "listener") ?? [];
      const firstListener = listeners[0];
      if (firstListener) {
        await supabase
          .from("participants")
          .update({ role: "speaker" })
          .eq("id", firstListener.id);
      }
    }

    await supabase.from("participants").delete().eq("user_id", userId);
    setRoomStatus({ status: "left" });
  }, [userId]);

  return { roomStatus, userId, leaveRoom, joinRoom };
}
