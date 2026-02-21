"use client";

import { useState } from "react";
import { useMessages } from "@/hooks/useMessages";

export function ListenerView() {
  const { messages, listenerHasReplied, sendMessage } = useMessages("listener");
  const [input, setInput] = useState("");

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || listenerHasReplied) return;
    await sendMessage(trimmed);
    setInput("");
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto px-6 py-8">
      {/* Top */}
      <div className="mb-6">
        <p className="text-lg font-medium text-black">You are listening</p>
        <p className="text-xs text-gray-500 mt-2 max-w-sm">
          You can send one anonymous reply. Only the Speaker will see it.
        </p>
      </div>

      {/* Speaker message history only */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-6">
        {messages.length === 0 && (
          <p className="text-gray-500 text-sm">No messages from the Speaker yet.</p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="flex justify-start">
            <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-bl-md bg-gray-100 text-black">
              <p className="text-sm">{msg.content}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="flex flex-col gap-2">
        {listenerHasReplied ? (
          <p className="text-sm text-gray-500 py-2">
            You have completed your reply.
          </p>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Type your reply..."
              className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="px-5 py-3 rounded-xl bg-black text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition"
            >
              Send
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
