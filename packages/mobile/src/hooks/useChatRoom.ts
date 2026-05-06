import { useCallback, useEffect, useRef, useState } from 'react';
import Constants from 'expo-constants';
import { io, type Socket } from 'socket.io-client';
import type { ChatMessageDto } from '@a-idol/shared';
import { api, ApiError } from '../api/client';

/**
 * 1:1 chat with an idol. Combines a REST "open" + history fetch with a
 * WebSocket connection for live reception. REST `send` stays the fallback
 * and mirrors into the WS room so any second client instance stays in sync.
 */
export function useChatRoom(idolId: string | undefined, token: string | null) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  // -- REST: open + history ---------------------------------------------
  const open = useCallback(async () => {
    if (!idolId || !token) return;
    setLoading(true);
    setError(null);
    try {
      const room = await api.openChatRoom(idolId, token);
      setRoomId(room.id);
      const hist = await api.listChatMessages(room.id, token);
      setMessages(hist);
    } catch (e) {
      setError(formatError(e));
    } finally {
      setLoading(false);
    }
  }, [idolId, token]);

  useEffect(() => {
    void open();
  }, [open]);

  // -- WS: connect after room is known ----------------------------------
  useEffect(() => {
    if (!roomId || !token) return;

    const base = process.env.EXPO_PUBLIC_API_BASE_URL ?? (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ?? 'http://localhost:3000/api/v1';
    // Strip the "/api/v1" version prefix — WS uses a separate `/chat` namespace.
    const origin = base.replace(/\/1$/, '');
    const socket = io(`${origin}/chat`, {
      auth: { token },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setWsConnected(true);
      socket.emit('room:join', { roomId }, (ack: { roomId?: string; code?: string; message?: string }) => {
        if (ack && 'code' in ack && ack.code) setError(`WS join: ${ack.message}`);
      });
    });
    socket.on('disconnect', () => setWsConnected(false));
    socket.on('error:chat', (e: { code: string; message: string }) => {
      setError(`WS ${e.code}: ${e.message}`);
    });
    socket.on('message:received', (msg: ChatMessageDto) => {
      // De-dupe against messages we already have from the REST send round-trip.
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setWsConnected(false);
    };
  }, [roomId, token]);

  // -- send (REST) — WS will echo via message:received ------------------
  const send = useCallback(
    async (content: string) => {
      if (!roomId || !token || !content.trim()) return;
      setSending(true);
      setError(null);
      try {
        const res = await api.sendChatMessage(roomId, content, token);
        // Optimistic local append (in case the WS echo is slow). `message:received`
        // will de-dupe on id.
        setMessages((prev) => [...prev, res.user, res.idol]);
      } catch (e) {
        setError(formatError(e));
        throw e;
      } finally {
        setSending(false);
      }
    },
    [roomId, token],
  );

  return {
    roomId,
    messages,
    sending,
    loading,
    error,
    wsConnected,
    send,
    reload: open,
  };
}

function formatError(e: unknown): string {
  if (e instanceof ApiError) return `${e.code ?? 'API_ERROR'}: ${e.message}`;
  return (e as Error).message ?? 'Unknown error';
}
