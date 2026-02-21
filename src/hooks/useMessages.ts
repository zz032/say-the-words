"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { getUserId } from "@/lib/utils";
import { getCurrentPeriodStart } from "@/lib/utils";
import type { Role } from "@/lib/supabase";

const SPEAKER_DAILY_LIMIT = 3;

export interface DisplayMessage {
  id: string;
  content: string;
  isSpeaker: boolean;
  createdAt: string;
}

// Admin 和 Speaker 都可以看到全部消息且可以发送
const CAN_SEND_AND_SEE_ALL: Role[] = ["admin", "speaker"];

export function useMessages(role: Role | null) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [speakerRemaining, setSpeakerRemaining] = useState<number>(SPEAKER_DAILY_LIMIT);
  const [listenerHasReplied, setListenerHasReplied] = useState<boolean>(false);
  const userId = typeof window !== "undefined" ? getUserId() : "";

  const fetchMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to fetch messages:", error);
      return;
    }

    const periodStart = getCurrentPeriodStart();

    if (role && CAN_SEND_AND_SEE_ALL.includes(role)) {
      const myMessages = (data ?? []).filter(
        (m) =>
          (m.sender_role === "speaker" || m.sender_role === "admin") &&
          m.sender_user_id === userId &&
          new Date(m.created_at) >= periodStart
      );
      setSpeakerRemaining(Math.max(0, SPEAKER_DAILY_LIMIT - myMessages.length));

      const speakerAdminMessages = (data ?? []).filter((m) =>
        ["speaker", "admin"].includes(m.sender_role)
      );
      const listenerReplies = (data ?? []).filter((m) => m.sender_role === "listener");

      const combined: DisplayMessage[] = [
        ...speakerAdminMessages.map((m) => ({
          id: m.id,
          content: m.content,
          isSpeaker: true,
          createdAt: m.created_at,
        })),
        ...listenerReplies.map((m) => ({
          id: m.id,
          content: m.content,
          isSpeaker: false,
          createdAt: m.created_at,
        })),
      ].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      setMessages(combined);
    } else if (role === "listener") {
      const hasReplied = (data ?? []).some(
        (m) => m.sender_role === "listener" && m.sender_user_id === userId
      );
      setListenerHasReplied(hasReplied);

      const speakerAdminOnly = (data ?? []).filter((m) =>
        ["speaker", "admin"].includes(m.sender_role)
      );
      setMessages(
        speakerAdminOnly.map((m) => ({
          id: m.id,
          content: m.content,
          isSpeaker: true,
          createdAt: m.created_at,
        }))
      );
    }
  }, [role, userId]);

  // 初始加载
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // 实时订阅消息变动，确保返回同步清理函数
  useEffect(() => {
    const channel = supabase.channel("messages-changes");

    const handler = () => {
      fetchMessages().catch(console.error); // 异步处理内部执行即可
    };

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "messages" },
      handler
    );

    channel.subscribe();

    // ❗ 这里返回同步函数，不加 async
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMessages]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!userId || !role) return;

      if (CAN_SEND_AND_SEE_ALL.includes(role)) {
        if (speakerRemaining <= 0) return;
        await supabase.from("messages").insert({
          content: content.trim(),
          sender_role: role,
          sender_user_id: userId,
        });
      } else if (role === "listener") {
        if (listenerHasReplied) return;
        await supabase.from("messages").insert({
          content: content.trim(),
          sender_role: "listener",
          sender_user_id: userId,
        });
      }
    },
    [userId, role, speakerRemaining, listenerHasReplied]
  );

  return {
    messages,
    speakerRemaining,
    listenerHasReplied,
    sendMessage,
    refreshMessages: fetchMessages,
  };
}