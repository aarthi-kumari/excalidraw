import { WebSocket, WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
import { prisma } from "@repo/db/client";

type SupportedMessage =
  | {
      type: "join_room";
      roomId: number;
    }
  | {
      type: "chat";
      roomId: number;
      message: string;
    };

type AuthenticatedSocketState = {
  userId: string;
  rooms: Set<number>;
};

const wss = new WebSocketServer({ port: 8080 });
const socketState = new Map<WebSocket, AuthenticatedSocketState>();
const roomSubscribers = new Map<number, Set<WebSocket>>();

function getUniqueUsersInRoom(roomId: number) {
  const subscribers = roomSubscribers.get(roomId);
  if (!subscribers) {
    return [] as string[];
  }

  const users = new Set<string>();
  for (const socket of subscribers) {
    const state = socketState.get(socket);
    if (state) {
      users.add(state.userId);
    }
  }

  return Array.from(users);
}

async function broadcastPresence(roomId: number) {
  const subscribers = roomSubscribers.get(roomId);
  if (!subscribers) {
    return;
  }

  const userIds = getUniqueUsersInRoom(roomId);
  const users = await prisma.user.findMany({
    where: {
      id: {
        in: userIds
      }
    },
    select: {
      id: true,
      name: true
    }
  });

  const payload = JSON.stringify({
    type: "presence_update",
    roomId,
    users,
    count: userIds.length
  });

  for (const subscriber of subscribers) {
    if (subscriber.readyState === WebSocket.OPEN) {
      subscriber.send(payload);
    }
  }
}

wss.on('connection', function connection(ws, request) {
  const url = request.url;
  if(!url){
    ws.close();
    return;
  }

  const queryParams = new URLSearchParams(url.split("?")[1]);
  const token = queryParams.get('token');
  if (!token) {
    ws.close();
    return;
  }

  let decoded: jwt.JwtPayload;
  try {
    decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
  } catch {
    ws.close();
    return;
  }

  if (!decoded.userId) {
    ws.close();
    return;
  }

  const userId = String(decoded.userId);
  const state: AuthenticatedSocketState = {
    userId,
    rooms: new Set<number>()
  };

  socketState.set(ws, state);

  ws.on('message', async function message(data) {
    const currentState = socketState.get(ws);
    if (!currentState) {
      return;
    }

    let parsedData: SupportedMessage;
    try {
      parsedData = JSON.parse(data.toString()) as SupportedMessage;
    } catch {
      return;
    }

    if (parsedData.type === "join_room") {
      currentState.rooms.add(parsedData.roomId);

      let subscribers = roomSubscribers.get(parsedData.roomId);
      if (!subscribers) {
        subscribers = new Set<WebSocket>();
        roomSubscribers.set(parsedData.roomId, subscribers);
      }
      subscribers.add(ws);

      ws.send(JSON.stringify({
        type: "joined_room",
        roomId: parsedData.roomId
      }));
      void broadcastPresence(parsedData.roomId);
      return;
    }

    if (parsedData.type === "chat") {
      if (!currentState.rooms.has(parsedData.roomId)) {
        return;
      }

      if (!parsedData.message?.trim()) {
        return;
      }

      const createdChat = await prisma.chat.create({
        data: {
          roomId: parsedData.roomId,
          userId: currentState.userId,
          message: parsedData.message
        }
      });

      const outgoingMessage = JSON.stringify({
        type: "chat",
        roomId: parsedData.roomId,
        chat: {
          id: createdChat.id,
          userId: currentState.userId,
          message: createdChat.message
        }
      });

      const subscribers = roomSubscribers.get(parsedData.roomId);
      if (!subscribers) {
        return;
      }

      for (const subscriber of subscribers) {
        if (subscriber.readyState === WebSocket.OPEN) {
          subscriber.send(outgoingMessage);
        }
      }
    }
  });

  ws.on('close', function close() {
    const currentState = socketState.get(ws);
    if (!currentState) {
      return;
    }

    const affectedRooms = Array.from(currentState.rooms);

    for (const roomId of currentState.rooms) {
      const subscribers = roomSubscribers.get(roomId);
      if (!subscribers) {
        continue;
      }

      subscribers.delete(ws);
      if (subscribers.size === 0) {
        roomSubscribers.delete(roomId);
      }
    }

    socketState.delete(ws);

    for (const roomId of affectedRooms) {
      void broadcastPresence(roomId);
    }
  });
});
