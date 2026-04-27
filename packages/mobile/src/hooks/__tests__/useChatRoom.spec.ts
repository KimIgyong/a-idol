// Mock socket.io-client BEFORE importing the hook so the WS branch is
// exercised without a real socket. Each `io()` call returns a controllable
// stub — tests drive `connect` / `message:received` callbacks directly.
interface FakeSocket {
  listeners: Record<string, Array<(arg: unknown) => void>>;
  emitted: Array<{ event: string; payload: unknown }>;
  on: (event: string, cb: (arg: unknown) => void) => void;
  emit: (event: string, payload: unknown, ack?: (res: unknown) => void) => void;
  disconnect: () => void;
  removeAllListeners: () => void;
  fire: (event: string, arg: unknown) => void;
}

const fakeSockets: FakeSocket[] = [];

function createFakeSocket(): FakeSocket {
  const socket: FakeSocket = {
    listeners: {},
    emitted: [],
    on(event, cb) {
      (this.listeners[event] ??= []).push(cb);
    },
    emit(event, payload, ack) {
      this.emitted.push({ event, payload });
      // Default room:join ack — success.
      if (event === 'room:join' && ack) ack({ roomId: (payload as { roomId: string }).roomId });
    },
    disconnect() {
      /* no-op */
    },
    removeAllListeners() {
      this.listeners = {};
    },
    fire(event, arg) {
      for (const cb of this.listeners[event] ?? []) cb(arg);
    },
  };
  return socket;
}

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => {
    const s = createFakeSocket();
    fakeSockets.push(s);
    return s;
  }),
}));

import { act, renderHook, waitFor } from '@testing-library/react';
import { useChatRoom } from '../useChatRoom';
import { installFetchMock, type FetchMock } from './test-utils';

function resetFakeSockets() {
  fakeSockets.length = 0;
}

describe('useChatRoom — REST open + send + WS live reception', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = installFetchMock();
    resetFakeSockets();
  });

  it('open loads the room + initial history, WS connect + room:join fires', async () => {
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'open',
      body: { id: 'room-1', idolId: 'idol-1', createdAt: '2026-04-24T00:00:00Z' },
    });
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'hist',
      body: [
        {
          id: 'm1',
          roomId: 'room-1',
          senderType: 'USER',
          content: 'hi',
          createdAt: '2026-04-24T00:00:00Z',
        },
      ],
    });

    const { result } = renderHook(() => useChatRoom('idol-1', 'tok'));

    await waitFor(() => expect(result.current.roomId).toBe('room-1'));
    expect(result.current.messages.length).toBe(1);

    // Socket should have been created and 'connect' event listeners registered.
    expect(fakeSockets.length).toBe(1);
    const sock = fakeSockets[0];
    act(() => {
      sock.fire('connect', undefined);
    });
    await waitFor(() => expect(result.current.wsConnected).toBe(true));
    expect(sock.emitted.find((e) => e.event === 'room:join')).toBeTruthy();
  });

  it('message:received de-dupes on message id', async () => {
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'open',
      body: { id: 'room-1', idolId: 'idol-1', createdAt: '2026-04-24T00:00:00Z' },
    });
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'hist',
      body: [],
    });

    const { result } = renderHook(() => useChatRoom('idol-1', 'tok'));
    await waitFor(() => expect(result.current.roomId).toBe('room-1'));

    const sock = fakeSockets[0];
    act(() => sock.fire('connect', undefined));

    const msg = {
      id: 'ws-1',
      roomId: 'room-1',
      senderType: 'IDOL',
      content: 'hello',
      createdAt: '2026-04-24T00:00:00Z',
    };
    act(() => sock.fire('message:received', msg));
    act(() => sock.fire('message:received', msg));
    await waitFor(() => expect(result.current.messages.length).toBe(1));
  });

  it('send appends user + idol messages via REST; subsequent WS echo is de-duped', async () => {
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'open',
      body: { id: 'room-1', idolId: 'idol-1', createdAt: '2026-04-24T00:00:00Z' },
    });
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'hist',
      body: [],
    });
    fetchMock.enqueue({
      ok: true,
      status: 201,
      requestId: 'send',
      body: {
        user: { id: 'u1', roomId: 'room-1', senderType: 'USER', content: 'yo', createdAt: 't1' },
        idol: { id: 'i1', roomId: 'room-1', senderType: 'IDOL', content: 'hi', createdAt: 't2' },
      },
    });

    const { result } = renderHook(() => useChatRoom('idol-1', 'tok'));
    await waitFor(() => expect(result.current.roomId).toBe('room-1'));

    await act(async () => {
      await result.current.send('yo');
    });
    expect(result.current.messages.map((m) => m.id)).toEqual(['u1', 'i1']);

    // WS echo with the same ids should not duplicate.
    const sock = fakeSockets[0];
    act(() =>
      sock.fire('message:received', {
        id: 'u1',
        roomId: 'room-1',
        senderType: 'USER',
        content: 'yo',
        createdAt: 't1',
      }),
    );
    expect(result.current.messages.length).toBe(2);
  });

  it('send is a no-op for empty content and when roomId is not yet known', async () => {
    // No roomId yet — first call should bail before hitting REST.
    const { result } = renderHook(() => useChatRoom('idol-1', 'tok'));
    await act(async () => {
      await result.current.send('   ');
    });
    // open() fired 2 fetches (room + history will fail since none enqueued)
    // but send itself hasn't because roomId is still null AND content is blank.
    expect(
      fetchMock.calls.filter((c) => c.path === '/chat/rooms/room-1/messages' && c.method === 'POST').length,
    ).toBe(0);
  });

  it('REST send 4xx surfaces formatted error and is thrown', async () => {
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'open',
      body: { id: 'room-1', idolId: 'idol-1', createdAt: '2026-04-24T00:00:00Z' },
    });
    fetchMock.enqueue({
      ok: true,
      status: 200,
      requestId: 'hist',
      body: [],
    });
    fetchMock.enqueue({
      ok: false,
      status: 402,
      requestId: 'send-fail',
      body: { code: 'CHAT_QUOTA_EXHAUSTED', message: 'daily quota hit' },
    });

    const { result } = renderHook(() => useChatRoom('idol-1', 'tok'));
    await waitFor(() => expect(result.current.roomId).toBe('room-1'));

    let caught: unknown = null;
    await act(async () => {
      try {
        await result.current.send('costly msg');
      } catch (e) {
        caught = e;
      }
    });
    expect(caught).toBeTruthy();
    expect(result.current.error).toContain('CHAT_QUOTA_EXHAUSTED');
  });
});
