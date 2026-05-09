// ── useSocket.js ──────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { BACKEND_URL, DEFAULT_STATE } from '../utils/constants.js';

export function useSocket({ role = 'audience', token = null }) {
  const socketRef   = useRef(null);
  const [connected, setConnected]   = useState(false);
  const [state, setState]           = useState({ ...DEFAULT_STATE });
  const [deviceId, setDeviceId]     = useState(0);
  const [stats, setStats]           = useState({ audience: 0, admins: 0, total: 0 });
  const [latency, setLatency]       = useState(0);
  const beatCbRef   = useRef(null);   // beat callback
  const pingStart   = useRef(0);

  useEffect(() => {
    const socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1500,
      reconnectionDelayMax: 8000,
      timeout: 10000,
      // Important for mobile: keep socket alive through app backgrounding
      closeOnBeforeunload: false,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      // Authenticate as admin if token provided
      if (role === 'admin' && token) {
        socket.emit('adminAuth', { token });
      }
      // Measure latency
      pingStart.current = performance.now();
      socket.emit('ping');
    });

    socket.on('pong', () => {
      setLatency(Math.round((performance.now() - pingStart.current) / 2));
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('state', (newState) => {
      setState(s => ({ ...s, ...newState }));
    });

    socket.on('deviceId', ({ id }) => setDeviceId(id));
    socket.on('stats', (s) => setStats(s));

    socket.on('beat', ({ t }) => {
      // Latency-compensated beat
      if (beatCbRef.current) beatCbRef.current({ serverTime: t, latency });
    });

    // Ping every 10s to measure latency and keep connection alive
    const pingInterval = setInterval(() => {
      if (socket.connected) {
        pingStart.current = performance.now();
        socket.emit('ping');
      }
    }, 10000);

    return () => {
      clearInterval(pingInterval);
      socket.disconnect();
    };
  }, [role, token]);

  // Emit state update (admin only)
  const dispatch = useCallback((patch) => {
    setState(s => ({ ...s, ...patch }));
    if (socketRef.current?.connected) {
      socketRef.current.emit('stateUpdate', patch);
    }
  }, []);

  // Register beat callback
  const onBeat = useCallback((cb) => {
    beatCbRef.current = cb;
  }, []);

  return { connected, state, deviceId, stats, latency, dispatch, onBeat };
}
