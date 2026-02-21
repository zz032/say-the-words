"use client";

import { useEffect, useState, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";
import { getUserId } from "@/lib/utils";
import { getCurrentPeriodStart } from "@/lib/utils";
import type { Role } from "@/lib/supabase";

const SPEAKER_DAILY_LIMIT = 3;

export interface DisplayMessage {
  id: string;
  content: string;
  isSpeaker: boolean;
  createdAt: string;
  replyCount?: number;
  myReplyContent?: string | null;
}

// Admin 和 Speaker 都可以看到全部消息且可以发送
const CAN_SEND_AND_SEE_ALL: Role[] = ["admin", "speaker"];

// `joinedAt` should be the ISO timestamp when the current user joined the room.
// Users who are not `admin` will only see messages with created_at >= joinedAt.
export function useMessages(role: Role | null, joinedAt?: string | null) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [speakerRemaining, setSpeakerRemaining] = useState<number>(SPEAKER_DAILY_LIMIT);
  const [listenerHasReplied, setListenerHasReplied] = useState<boolean>(false);
  const userId = typeof window !== "undefined" ? getUserId() : "";

  const fetchMessages = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) {
      console.error("Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }
    // Admin can see everything. Other roles only see messages created after they joined.
    const SEE_ALL: Role[] = ["admin"];

    let query = supabase.from("messages").select("*").order("created_at", { ascending: true });
    if (!(role && SEE_ALL.includes(role)) && joinedAt) {
      query = query.gte("created_at", joinedAt);
    }

    const { data, error } = await query;

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

      const all = data ?? [];
      const speakerAdminMessages = all.filter((m) => ["speaker", "admin"].includes(m.sender_role));
      const listenerReplies = all.filter((m) => m.sender_role === "listener");

      const combined: DisplayMessage[] = speakerAdminMessages
        .map((m) => {
          const count = listenerReplies.filter((r) => r.reply_to === m.id).length;
          return {
            id: m.id,
            content: m.content,
            isSpeaker: true,
            createdAt: m.created_at,
            replyCount: count,
          } as DisplayMessage;
        })
        .concat(
          listenerReplies.map((m) => ({
            id: m.id,
            content: m.content,
            isSpeaker: false,
            createdAt: m.created_at,
          }))
        )
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      setMessages(combined);
    } else if (role === "listener") {
      const hasReplied = (data ?? []).some(
        (m) => m.sender_role === "listener" && m.sender_user_id === userId
      );
      setListenerHasReplied(hasReplied);

      const all = data ?? [];
      const speakerAdminOnly = all.filter((m) => ["speaker", "admin"].includes(m.sender_role));
      const listenerReplies = all.filter((m) => m.sender_role === "listener");

      const combined: DisplayMessage[] = speakerAdminOnly.map((m) => {
        const count = listenerReplies.filter((r) => r.reply_to === m.id).length;
        const myReply = listenerReplies.find((r) => r.reply_to === m.id && r.sender_user_id === userId);
        return {
          id: m.id,
          content: m.content,
          isSpeaker: true,
          createdAt: m.created_at,
          replyCount: count,
          myReplyContent: myReply ? myReply.content : null,
        } as DisplayMessage;
      });

      setMessages(combined);
    }
  }, [role, userId]);

  // 初始加载
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // 实时订阅消息变动，确保返回同步清理函数
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

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
    async (content: string, replyTo?: string | null) => {
      if (!userId || !role) return;

      const supabase = getSupabase();
      if (!supabase) return;

      if (CAN_SEND_AND_SEE_ALL.includes(role)) {
        if (speakerRemaining <= 0) return;
        await supabase.from("messages").insert({
          content: content.trim(),
          sender_role: role,
          sender_user_id: userId,
          reply_to: null,
        });
      } else if (role === "listener") {
        if (listenerHasReplied) return;
        // Listeners must reply to an existing speaker message
        if (!replyTo) return;
        await supabase.from("messages").insert({
          content: content.trim(),
          sender_role: "listener",
          sender_user_id: userId,
          reply_to: replyTo,
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