import { create } from 'zustand';

export const useStore = create((set) => ({
  heartbeatData: null,
  isConnected: false,
  lastUpdate: null,
  error: null,

  setHeartbeatData: (data) => set({ 
    heartbeatData: data, 
    isConnected: true, 
    lastUpdate: Date.now(),
    error: null 
  }),
  
  setError: (error) => set({ 
    error, 
    isConnected: false 
  }),
  
  setLastUpdate: (timestamp) => set({ lastUpdate: timestamp }),
}));
