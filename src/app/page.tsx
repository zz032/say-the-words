"use client";

import { useRoom } from "@/hooks/useRoom";
import { SpeakerView } from "@/components/SpeakerView";
import { ListenerView } from "@/components/ListenerView";
import dynamic from "next/dynamic";

const AdminObserver = dynamic(() => import("@/components/AdminObserver"), { ssr: false });

export default function Home() {
  const { roomStatus, leaveRoom, joinRoom } = useRoom();

  const hasSupabaseConfig =
    typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string" &&
    typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === "string";

  if (!hasSupabaseConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <p className="text-lg font-medium text-black mb-2">
            Setup required
          </p>
          <p className="text-sm text-gray-600 mb-4">
            Copy .env.local.example to .env.local and add your Supabase URL and
            anon key. Then run the SQL in supabase-schema.sql in your Supabase
            SQL Editor.
          </p>
        </div>
      </div>
    );
  }

  if (roomStatus.status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Joining room...</p>
      </div>
    );
  }

  if ((roomStatus as any).status === "error") {
    const msg = (roomStatus as any).message ?? "Unknown error";
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-center text-lg text-red-600">Error joining room</p>
        <p className="text-center text-sm text-gray-600 max-w-md">{msg}</p>
        <div className="pt-4">
          <button
            onClick={joinRoom}
            className="px-5 py-3 rounded-xl bg-black text-white font-medium hover:bg-gray-800 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (roomStatus.status === "full") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <p className="text-center text-lg text-black">
          Room is full. Please try again later.
        </p>
      </div>
    );
  }

  if (roomStatus.status === "left") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-center text-lg text-black">You have left the room.</p>
        <button
          onClick={joinRoom}
          className="px-5 py-3 rounded-xl bg-black text-white font-medium hover:bg-gray-800 transition"
        >
          Join again
        </button>
      </div>
    );
  }

  if (roomStatus.status === "joined") {
    // If URL contains ?admin=godmode, open observer dashboard (does not join)
    const isGodmode = typeof window !== "undefined" && window.location.search.includes("admin=godmode");
    if (isGodmode) {
      return <AdminObserver />;
    }
    if (roomStatus.role === "admin" || roomStatus.role === "speaker") {
      return (
        <SpeakerView
          role={roomStatus.role}
          onLeaveRoom={leaveRoom}
        />
      );
    }
    return <ListenerView />;
  }

  return null;
}
