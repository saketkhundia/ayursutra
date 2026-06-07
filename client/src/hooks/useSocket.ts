import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    socket = io(window.location.origin, {
      path: '/ws',
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
  }
  return socket;
}

export function useSocket() {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket>(getSocket());

  useEffect(() => {
    const s = socketRef.current;
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    if (s.connected) setConnected(true);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
    };
  }, []);

  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    socketRef.current.on(event, handler);
    return () => { socketRef.current.off(event, handler); };
  }, []);

  /** @deprecated Prefer joinDashboard / joinPatientChannel — server listens for join:dashboard and join:patient */
  const joinRoom = useCallback((room: string) => {
    if (room === 'dashboard') {
      socketRef.current.emit('join:dashboard');
    } else {
      socketRef.current.emit('join', room);
    }
  }, []);

  const joinDashboard = useCallback(() => {
    socketRef.current.emit('join:dashboard');
  }, []);

  const joinPatientChannel = useCallback((patientId: string) => {
    if (patientId) socketRef.current.emit('join:patient', patientId);
  }, []);

  const leaveRoom = useCallback((room: string) => {
    socketRef.current.emit('leave', room);
  }, []);

  return { socket: socketRef.current, connected, on, joinRoom, joinDashboard, joinPatientChannel, leaveRoom };
}
