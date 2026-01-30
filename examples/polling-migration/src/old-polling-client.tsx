/**
 * OLD Client Implementation using Polling
 * 
 * This file shows traditional polling-based real-time updates.
 * Keep this for reference during migration.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface Notification {
  id: string;
  type: 'info' | 'warning' | 'success' | 'error';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

interface NotificationResponse {
  notifications: Notification[];
  unreadCount: number;
}

/**
 * OLD Hook: usePollingNotifications
 * 
 * Problems:
 * 1. Fetches full payload every interval, even if nothing changed
 * 2. Tradeoff between freshness and server load
 * 3. Wastes bandwidth on unchanged data
 * 4. No way to optimize without server changes
 */
export function usePollingNotifications(intervalMs: number = 2000) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [requestCount, setRequestCount] = useState(0);
  const intervalRef = useRef<number | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      // ALWAYS fetches full payload - wasteful!
      const response = await fetch('http://localhost:3001/api/notifications');
      const data: NotificationResponse = await response.json();
      
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
      setRequestCount(prev => prev + 1);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await fetch(`http://localhost:3001/api/notifications/${id}/read`, {
        method: 'PATCH',
      });
      // Optimistic update
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchNotifications();

    // Start polling loop - runs FOREVER
    intervalRef.current = window.setInterval(fetchNotifications, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchNotifications, intervalMs]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    requestCount,
    markAsRead,
    refresh: fetchNotifications,
  };
}

/**
 * OLD Component using Polling
 */
export function OldNotificationCenter() {
  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    requestCount,
    markAsRead,
  } = usePollingNotifications(2000); // Poll every 2 seconds

  if (error) {
    return <div className="error">Error: {error.message}</div>;
  }

  return (
    <div className="notification-center">
      <header className="notification-header">
        <h2>
          Notifications
          {unreadCount > 0 && (
            <span className="badge">{unreadCount}</span>
          )}
        </h2>
        <div className="stats">
          <span className="request-count">
            📊 Requests: {requestCount}
          </span>
          <span className="mode">🔴 Polling (2s)</span>
        </div>
      </header>

      {isLoading ? (
        <div className="loading">Loading...</div>
      ) : (
        <div className="notification-list">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`notification ${notification.type} ${notification.read ? 'read' : 'unread'}`}
              onClick={() => !notification.read && markAsRead(notification.id)}
            >
              <div className="notification-icon">
                {notification.type === 'info' && 'ℹ️'}
                {notification.type === 'warning' && '⚠️'}
                {notification.type === 'success' && '✅'}
                {notification.type === 'error' && '❌'}
              </div>
              <div className="notification-content">
                <h3>{notification.title}</h3>
                <p>{notification.message}</p>
                <time>
                  {new Date(notification.timestamp).toLocaleTimeString()}
                </time>
              </div>
              {!notification.read && (
                <div className="unread-indicator" />
              )}
            </div>
          ))}
        </div>
      )}

      <footer className="notification-footer">
        <small>
          ⚠️ Fetching full payload every 2 seconds regardless of changes
        </small>
      </footer>
    </div>
  );
}
