import { useEffect } from 'react';
import { useStore } from '../store/store';

const POLL_INTERVAL = 60000;

export function usePolling() {
  const { setHeartbeatData, setError, lastUpdate, isConnected } = useStore();

  const fetchHeartbeat = async () => {
    try {
      const response = await fetch('/api/heartbeat');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setHeartbeatData(data);
    } catch (error) {
      console.error('Failed to fetch heartbeat:', error);
      setError(error.message);
    }
  };

  useEffect(() => {
    fetchHeartbeat();
    const interval = setInterval(fetchHeartbeat, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  return { lastUpdate, isConnected };
}
