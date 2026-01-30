/**
 * NEW Client Implementation using Reality
 * 
 * This file shows the Reality approach - version-based sync.
 * Visibly reduced network usage!
 */

import { useReality, useMutation, useRealityClient, createPollingAdapter, type PollingAdapterControl } from '@rootlodge/reality';
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
export function usePollingCompatNotifications() {
  const client = useRealityClient();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [syncCount, setSyncCount] = useState(0);
  const [fetchCount, setFetchCount] = useState(0);
  const adapterRef = useRef<PollingAdapterControl | null>(null);

  useEffect(() => {
    // Create polling adapter with Reality integration
    const adapter = createPollingAdapter<NotificationResponse>(
      'http://localhost:3000/api/notifications',
      (data) => {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
        setFetchCount(prev => prev + 1);
        setIsLoading(false);
        setError(null);
      },
      client,
      {
        realityKey: 'notifications:all',
        syncOnFocus: true,
        syncOnVisibility: true,
      }
    );
    
    adapterRef.current = adapter;
    
    // Initial sync
    adapter.sync().then(() => {
      setSyncCount(prev => prev + 1);
    }).catch((err: Error) => {
      setError(err);
      setIsLoading(false);
    });
    
    return () => adapter.stop();
  }, [client]);

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
  const [syncCount, setSyncCount] = useState(0);
  const [fetchCount, setFetchCount] = useState(0);

  const {
    data,
    isLoading,
    isSyncing,
    error,
    sync,
    lastSyncAt,
  } = useReality<NotificationResponse>(
    'notifications:all',
    {
      fallback: { notifications: [], unreadCount: 0 },
      
      fetcher: async () => {
        setFetchCount(prev => prev + 1);
        const response = await fetch('http://localhost:3000/api/notifications');
        return response.json();
      },
      
      // Refetch on focus
      refetchOnFocus: true,
      refetchOnReconnect: true,
    }
  );

  const { mutate: markAsReadMutation } = useMutation<NotificationResponse, string>(
    'notifications:all',
    async (id) => {
      await fetch(`http://localhost:3000/api/notifications/${id}/read`, {
        method: 'PATCH',
      });
      // Return updated data
      const response = await fetch('http://localhost:3000/api/notifications');
      return response.json();
    },
    {
      // Optimistic update
      optimisticUpdate: (current, id) => ({
        notifications: (current?.notifications ?? []).map(n =>
          n.id === id ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, (current?.unreadCount ?? 0) - 1),
      }),
      rollbackOnError: true,
    }
  );

  // Track sync count
  useEffect(() => {
    if (lastSyncAt) {
      setSyncCount(prev => prev + 1);
    }
  }, [lastSyncAt]);

  const handleSync = useCallback(async () => {
    await sync('interaction');
  }, [sync]);

  return {
    notifications: data?.notifications ?? [],
    unreadCount: data?.unreadCount ?? 0,
    isLoading,
    isSyncing,
    error,
    syncCount,
    fetchCount,
    markAsRead: markAsReadMutation,
    refresh: handleSync,
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

  const handleNotificationClick = useCallback((notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
  }, [markAsRead]);

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
              onClick={() => handleNotificationClick(notification)}
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
  } = usePollingCompatNotifications();

  const handleNotificationClick = useCallback((notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
  }, [markAsRead]);

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
          <button onClick={() => refresh?.()}>Refresh</button>
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
              onClick={() => handleNotificationClick(notification)}
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
