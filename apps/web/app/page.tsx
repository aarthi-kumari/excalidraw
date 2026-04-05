"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";

type ChatMessage = {
  id: number;
  message: string;
  userId: string;
  user?: {
    id: string;
    name: string;
  };
};

type RoomSummary = {
  id: number;
  slug: string;
  createdAt: string;
};

type PresenceUser = {
  id: string;
  name: string;
};

const HTTP_BASE_URL = process.env.NEXT_PUBLIC_HTTP_URL ?? "http://localhost:3001";
const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080";

type ApiResult = {
  res: Response | null;
  data: any;
  networkError: boolean;
};

async function safeFetchJson(input: RequestInfo | URL, init?: RequestInit): Promise<ApiResult> {
  try {
    const res = await fetch(input, init);
    let data: any = null;

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      data = await res.json();
    }

    return {
      res,
      data,
      networkError: false,
    };
  } catch {
    return {
      res: null,
      data: null,
      networkError: true,
    };
  }
}

export default function Home() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("test@example.com");
  const [password, setPassword] = useState("pass123");
  const [name, setName] = useState("Test User");
  const [token, setToken] = useState<string | null>(null);

  const [roomName, setRoomName] = useState("general");
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<number | null>(null);
  const [activeRoomSlug, setActiveRoomSlug] = useState<string>("");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [presenceByRoom, setPresenceByRoom] = useState<Record<number, PresenceUser[]>>({});
  const [draftMessage, setDraftMessage] = useState("hello from web");
  const [statusText, setStatusText] = useState("Start by signing in.");

  const wsRef = useRef<WebSocket | null>(null);
  const activeRoomIdRef = useRef<number | null>(null);

  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);

  useEffect(() => {
    const savedToken = window.localStorage.getItem("draw-app-token");
    if (savedToken) {
      setToken(savedToken);
      setStatusText("Session restored. Create or join a room.");
    }
  }, []);

  useEffect(() => {
    if (!token) {
      setRooms([]);
      setPresenceByRoom({});
      return;
    }

    fetchRooms(token).catch(() => {
      setStatusText("Failed to load rooms.");
    });
  }, [token]);

  useEffect(() => {
    if (!token) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    const ws = new WebSocket(`${WS_BASE_URL}?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatusText("WebSocket connected.");
      const roomId = activeRoomIdRef.current;
      if (roomId) {
        ws.send(JSON.stringify({ type: "join_room", roomId }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(String(event.data));
        if (parsed.type === "chat" && parsed.roomId === activeRoomIdRef.current) {
          setMessages((prev) => [...prev, parsed.chat]);
          return;
        }

        if (parsed.type === "presence_update" && typeof parsed.roomId === "number") {
          const users = Array.isArray(parsed.users)
            ? (parsed.users as PresenceUser[])
            : [];
          setPresenceByRoom((prev) => ({
            ...prev,
            [parsed.roomId]: users,
          }));
        }
      } catch {
        setStatusText("Received malformed WS payload.");
      }
    };

    ws.onerror = () => {
      setStatusText("WebSocket error. Check ws-backend server.");
    };

    ws.onclose = () => {
      setStatusText("WebSocket disconnected.");
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [token]);

  const canSend = useMemo(() => {
    return Boolean(token && activeRoomId && draftMessage.trim());
  }, [token, activeRoomId, draftMessage]);

  const onlineUsers = useMemo(() => {
    if (!activeRoomId) {
      return [] as PresenceUser[];
    }
    return presenceByRoom[activeRoomId] ?? [];
  }, [activeRoomId, presenceByRoom]);

  async function signUp() {
    const { res, data, networkError } = await safeFetchJson(`${HTTP_BASE_URL}/signup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });

    if (networkError || !res) {
      setStatusText("Cannot reach backend. Start http-backend on port 3001.");
      return;
    }

    if (!res.ok) {
      setStatusText(data?.message ?? "Signup failed.");
      return;
    }

    setStatusText("Signup complete. Switch to sign in.");
    setMode("signin");
  }

  async function signIn() {
    const { res, data, networkError } = await safeFetchJson(`${HTTP_BASE_URL}/signin`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (networkError || !res) {
      setStatusText("Cannot reach backend. Start http-backend on port 3001.");
      return;
    }

    if (!res.ok) {
      setStatusText(data?.message ?? "Signin failed.");
      return;
    }

    setToken(data.token);
    window.localStorage.setItem("draw-app-token", data.token);
    setStatusText("Signed in. Create a room and start chatting.");
  }

  async function createRoom() {
    if (!token) {
      setStatusText("Sign in first.");
      return;
    }

    const { res, data, networkError } = await safeFetchJson(`${HTTP_BASE_URL}/room`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ roomName }),
    });

    if (networkError || !res) {
      setStatusText("Cannot reach backend. Start http-backend on port 3001.");
      return;
    }

    if (!res.ok) {
      setStatusText(data.message ?? "Room creation failed.");
      return;
    }

    await fetchRooms(token, data.roomId);
    setStatusText(`Room #${data.roomId} ready.`);
  }

  async function fetchRooms(authToken: string, preferredRoomId?: number) {
    const { res, data, networkError } = await safeFetchJson(`${HTTP_BASE_URL}/rooms`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${authToken}`,
      },
    });

    if (networkError || !res) {
      setStatusText("Cannot reach backend. Start http-backend on port 3001.");
      return;
    }

    if (!res.ok) {
      setStatusText(data.message ?? "Failed to load rooms.");
      return;
    }

    const nextRooms = (data.rooms ?? []) as RoomSummary[];
    setRooms(nextRooms);

    if (nextRooms.length === 0) {
      setActiveRoomId(null);
      setActiveRoomSlug("");
      setMessages([]);
      setPresenceByRoom({});
      return;
    }

    const preferredRoom = typeof preferredRoomId === "number"
      ? nextRooms.find((room) => room.id === preferredRoomId)
      : undefined;

    const currentRoom = typeof activeRoomIdRef.current === "number"
      ? nextRooms.find((room) => room.id === activeRoomIdRef.current)
      : undefined;

    const targetRoom = preferredRoom ?? currentRoom ?? nextRooms[0];
    if (!targetRoom) {
      return;
    }

    await selectRoom(targetRoom.id, targetRoom.slug, authToken, false);
  }

  async function loadChats(roomId: number, authToken: string) {
    const { res, data, networkError } = await safeFetchJson(`${HTTP_BASE_URL}/chats/${roomId}`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${authToken}`,
      },
    });

    if (networkError || !res) {
      setStatusText("Cannot reach backend. Start http-backend on port 3001.");
      return;
    }

    if (!res.ok) {
      setStatusText(data.message ?? "Failed to load chat history.");
      return;
    }

    setMessages(data.chats ?? []);
  }

  async function selectRoom(roomId: number, slug: string, authToken: string, shouldUpdateStatus = true) {
    setActiveRoomId(roomId);
    setActiveRoomSlug(slug);

    await loadChats(roomId, authToken);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "join_room", roomId }));
    }

    if (shouldUpdateStatus) {
      setStatusText(`Switched to room #${roomId}.`);
    }
  }

  function sendMessage() {
    if (!canSend || !activeRoomId || !wsRef.current) {
      return;
    }

    wsRef.current.send(
      JSON.stringify({
        type: "chat",
        roomId: activeRoomId,
        message: draftMessage,
      }),
    );
    setDraftMessage("");
  }

  function logout() {
    window.localStorage.removeItem("draw-app-token");
    setToken(null);
    setRooms([]);
    setActiveRoomId(null);
    setActiveRoomSlug("");
    setMessages([]);
    setPresenceByRoom({});
    setStatusText("Signed out.");
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.leftPanel}>
        <h1 className={styles.brand}>Chat Hub</h1>
        <p className={styles.caption}>Realtime room chat</p>

        <div className={styles.tabs}>
          <button
            className={mode === "signin" ? styles.tabActive : styles.tab}
            onClick={() => setMode("signin")}
            type="button"
          >
            Sign In
          </button>
          <button
            className={mode === "signup" ? styles.tabActive : styles.tab}
            onClick={() => setMode("signup")}
            type="button"
          >
            Sign Up
          </button>
        </div>

        <label className={styles.label}>Email</label>
        <input className={styles.input} value={email} onChange={(e) => setEmail(e.target.value)} />

        <label className={styles.label}>Password</label>
        <input
          className={styles.input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {mode === "signup" ? (
          <>
            <label className={styles.label}>Display Name</label>
            <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} />
            <button className={styles.primary} type="button" onClick={signUp}>
              Create Account
            </button>
          </>
        ) : (
          <button className={styles.primary} type="button" onClick={signIn}>
            Enter Workspace
          </button>
        )}

        <div className={styles.rule} />

        <label className={styles.label}>Room Name</label>
        <input className={styles.input} value={roomName} onChange={(e) => setRoomName(e.target.value)} />
        <div className={styles.row}>
          <button className={styles.secondary} type="button" onClick={createRoom}>
            Create Room
          </button>
          <button className={styles.ghost} type="button" onClick={logout}>
            Sign Out
          </button>
        </div>

        <div className={styles.roomsBlock}>
          <p className={styles.roomsTitle}>Rooms</p>
          <div className={styles.roomList}>
            {rooms.length === 0 ? (
              <p className={styles.roomsEmpty}>No rooms yet.</p>
            ) : (
              rooms.map((room) => (
                <button
                  key={room.id}
                  className={room.id === activeRoomId ? styles.roomItemActive : styles.roomItem}
                  type="button"
                  onClick={() => {
                    if (!token) {
                      return;
                    }
                    selectRoom(room.id, room.slug, token).catch(() => {
                      setStatusText("Failed to switch room.");
                    });
                  }}
                >
                  <span className={styles.roomMeta}>#{room.id}</span>
                  <strong>{room.slug}</strong>
                  <small>{new Date(room.createdAt).toLocaleDateString()}</small>
                </button>
              ))
            )}
          </div>
        </div>

        <p className={styles.status}>{statusText}</p>
      </aside>

      <section className={styles.chatPanel}>
        <div className={styles.chatHeader}>
          <div>
            <h2>Room {activeRoomId ? `#${activeRoomId}` : "-"}</h2>
            <span>{activeRoomSlug || "No room yet"}</span>
          </div>
          <div className={styles.presencePanel}>
            <strong>{onlineUsers.length} online</strong>
            <div className={styles.presenceList}>
              {onlineUsers.length === 0 ? (
                <small>No one online</small>
              ) : (
                onlineUsers.map((user) => (
                  <span key={user.id} className={styles.presenceChip}>
                    {user.name || user.id}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        <div className={styles.messages}>
          {messages.length === 0 ? (
            <p className={styles.empty}>No messages yet. Send the first one.</p>
          ) : (
            messages.map((message) => (
              <article key={`${message.id}-${message.message}`} className={styles.messageCard}>
                <header>
                  <strong>{message.user?.name || message.userId}</strong>
                  <small>#{message.id}</small>
                </header>
                <p>{message.message}</p>
              </article>
            ))
          )}
        </div>

        <div className={styles.composer}>
          <input
            className={styles.composerInput}
            value={draftMessage}
            onChange={(e) => setDraftMessage(e.target.value)}
            placeholder="Write a message..."
          />
          <button className={styles.primary} type="button" onClick={sendMessage} disabled={!canSend}>
            Send
          </button>
        </div>
      </section>
    </div>
  );
}
