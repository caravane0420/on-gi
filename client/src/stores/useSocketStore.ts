/* ================================================================
 * Socket Connection Store (Zustand)
 *
 * The FIRST connect is driven by App.tsx (which shows a boot splash and
 * awaits the initial rejoin). Every SUBSEQUENT connect is a transient
 * reconnection — here we silently re-attach the socket to its room so a
 * dropped Wi-Fi / server restart heals itself without user action.
 * ================================================================ */

import { create } from 'zustand';
import { socket } from '../lib/socket';
import { loadSession } from '../lib/session';
import { useRoomStore } from './useRoomStore';

let hasConnectedBefore = false;

interface SocketState {
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
}

export const useSocketStore = create<SocketState>((set) => {
  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id);
    set({ isConnected: true });

    // Re-connection (not the very first): reclaim the room seat
    if (hasConnectedBefore) {
      const saved = loadSession();
      if (saved) {
        useRoomStore.getState().rejoin(saved.roomId, saved.nickname);
      }
    }
    hasConnectedBefore = true;
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
    set({ isConnected: false });
  });

  socket.on('connect_error', (err) => {
    console.error('[Socket] Connection error:', err.message);
  });

  return {
    isConnected: false,

    connect() {
      if (!socket.connected) socket.connect();
    },

    disconnect() {
      if (socket.connected) socket.disconnect();
    },
  };
});
