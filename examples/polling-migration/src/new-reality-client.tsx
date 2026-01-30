/**
 * NEW Client Implementation using Reality
 * 
 * This file shows the Reality approach - version-based sync.
 * Visibly reduced network usage!
 */

import { useReality, useMutation } from '@rootlodge/reality/react';
import { createPollingAdapter } from '@rootlodge/reality/compat';
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
 * MIGRATION OPTION 1: Polling Adapter (Drop-in replacement)
 * 
 * Uses Reality's version checking but maintains polling pattern.
 * Only fetches full payload when version changes.
 * 
 * Good for: Quick migration with minimal code changes
 */
export function usePollingCompatNotifications(intervalMs: number = 2000) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [syncCount, setSyncCount] = useState(0);
  const [fetchCount, setFetchCount] = useState(0);
  const adapterRef = useRef<ReturnType<typeof createPollingAdapter> | null>(null);

  useEffect(() => {
    // Create polling adapter with Reality integration
    const adapter = createPollingAdapter<NotificationResponse>({
      key: 'notifications:all',
      realityEndpoint: 'http://localhost:3000/reality/sync',
      payloadEndpoint: 'http://localhost:3000/api/notifications',
      interval: intervalMs,
      
      onSync: () => {
        setSyncCount(prev => prev + 1);
      },
      
      onData: (data) => {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
        setFetchCount(prev => prev + 1);
        setIsLoading(false);
        setError(null);
      },
      
      onError: (err) => {
        setError(err);
        setIsLoading(false);
      },
    });
    
    adapterRef.current = adapter;
    adapter.start();
    
    return () => adapter.stop();
  }, [intervalMs]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await fetch(`http://localhost:3000/api/notifications/${id}/read`, {
        method: 'PATCH',
      });
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      // Force a sync to get updated version
      adapterRef.current?.sync();
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  }, []);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    syncCount,
    fetchCount,
    markAsRead,
    refresh: () => adapterRef.current?.sync(),
  };
}

/**
 * MIGRATION OPTION 2: Native Reality hook (RECOMMENDED)
 * 
 * Full Reality integration:
 * - Version-based invalidation
 * - Automatic focus/visibility handling
 * - No polling loops needed
 * - Best efficiency
 */
export function useRealityNotifications() {
  const {
    data,
    isLoading,
    isSyncing,
    error,
    sync,
    meta,
  } = useReality<NotificationResponse>(
    'notifications:all',
    {
      fallback: { notifications: [], unreadCount: 0 },
      
      fetcher: async () => {
        const response = await fetch('http://localhost:3000/api/notifications');
        return response.json();
      },
      
      // Only refetch when stale
      staleTime: 1000,
      
      // Dedupe rapid requests
      dedupeInterval: 200,
    }
  );

  const { mutate: markAsReadMutation } = useMutation<void, string>(
    'notifications:all',
    async (id) => {
      await fetch(`http://localhost:3000/api/notifications/${id}/read`, {
        method: 'PATCH',
      });
    },
    {
      // Optimistic update
      optimisticUpdate: (current, id) => ({
        ...current,
        notifications: current.notifications.map(n =>
          n.id === id ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, current.unreadCount - 1),
      }),
      rollbackOnError: true,
    }
  );

  return {
    notifications: data?.notifications ?? [],
    unreadCount: data?.unreadCount ?? 0,
    isLoading,
    isSyncing,
    error,
    syncCount: meta?.syncCount ?? 0,
    fetchCount: meta?.fetchCount ?? 0,
    markAsRead: markAsReadMutation,
    refresh: sync,
  };
}

/**
 * NEW Component using Reality (native mode)
 */
export function NotificationCenter() {
  const {
    notifications,
    unreadCount,
    isLoading,
    isSyncing,
    error,
    syncCount,
    fetchCount,
    markAsRead,
    refresh,
  } = useRealityNotifications();

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
          <span className="sync-count">
            🔄 Syncs: {syncCount}
          </span>
          <span className="fetch-count">
            📦 Fetches: {fetchCount}
          </span>
          <span className="mode">🟢 Reality</span>
          <button onClick={refresh} disabled={isSyncing}>
            {isSyncing ? 'Syncing...' : 'Refresh'}
          </button>
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
          ✅ Only {fetchCount} payload fetches for {syncCount} sync checks
          {syncCount > 0 && fetchCount > 0 && (
            <> (~{Math.round((1 - fetchCount / syncCount) * 100)}% bandwidth saved)</>
          )}
        </small>
      </footer>
    </div>
  );
}

/**
 * Component using polling compatibility layer
 */
export function NotificationCenterCompat() {
  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    syncCount,
    fetchCount,
    markAsRead,
    refresh,
  } = usePollingCompatNotifications(2000);

  if (error) {
    return <div className="error">Error: {error.message}</div>;
  }

  return (
    <div className="notification-center compat">
      <header className="notification-header">
        <h2>
          Notifications
          {unreadCount > 0 && (
            <span className="badge">{unreadCount}</span>
          )}
        </h2>
        <div className="stats">
          <span className="sync-count">
            🔄 Syncs: {syncCount}
          </span>
          <span className="fetch-count">
            📦 Fetches: {fetchCount}
          </span>
          <span className="mode">🟡 Polling Compat</span>
          <button onClick={refresh}>Refresh</button>
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
          Using polling adapter with version-based skip
        </small>
      </footer>
    </div>
  );
}
