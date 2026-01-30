import { useState } from 'react';
import { useReality, useMutation } from '@rootlodge/reality';
import { z } from 'zod';

// Message schema
const MessageSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  userId: z.string(),
  username: z.string(),
  text: z.string(),
  timestamp: z.number(),
  pending: z.boolean().optional(),
});

type Message = z.infer<typeof MessageSchema>;

const MessagesSchema = z.array(MessageSchema);

// Generate random user for demo
const currentUser = {
  id: crypto.randomUUID(),
  username: `User_${Math.random().toString(36).slice(2, 6)}`,
};

function App() {
  const [roomId] = useState('general');
  const [inputText, setInputText] = useState('');

  // Subscribe to chat room messages
  const {
    data: messages,
    isLoading,
    isSyncing,
    error,
    sync,
  } = useReality<Message[]>(`chat:room:${roomId}`, {
    fallback: [],
    schema: MessagesSchema,
    refetchOnFocus: true,
    refetchOnReconnect: true,
    // Custom fetcher to get full payload from API
    fetcher: async (key) => {
      const id = key.split(':').pop();
      const response = await fetch(`http://localhost:3001/api/rooms/${id}`);
      return response.json();
    },
  });

  // Mutation for sending messages with optimistic update
  const { mutate: sendMessage, isLoading: isSending } = useMutation<Message, string>(
    `chat:room:${roomId}`,
    async (text) => {
      const response = await fetch('http://localhost:3001/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          userId: currentUser.id,
          username: currentUser.username,
          text,
        }),
      });
      return response.json();
    },
    {
      // Optimistic update - show message immediately
      optimisticUpdate: (currentMessages, text) => [
        ...(currentMessages ?? []),
        {
          id: `temp-${Date.now()}`,
          roomId,
          userId: currentUser.id,
          username: currentUser.username,
          text,
          timestamp: Date.now(),
          pending: true,
        },
      ],
      rollbackOnError: true,
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const text = inputText;
    setInputText('');

    try {
      await sendMessage(text);
    } catch (err) {
      console.error('Failed to send message:', err);
      setInputText(text); // Restore on error
    }
  };

  return (
    <div className="chat-container">
      <header className="chat-header">
        <h1>Reality Chat Demo</h1>
        <div className="status">
          {isSyncing && <span className="syncing">Syncing...</span>}
          <span className="user">Logged in as: {currentUser.username}</span>
        </div>
      </header>

      <main className="chat-messages">
        {isLoading && <div className="loading">Loading messages...</div>}
        {error && <div className="error">Error: {error.message}</div>}

        {messages?.map((msg) => (
          <div
            key={msg.id}
            className={`message ${msg.userId === currentUser.id ? 'own' : ''} ${msg.pending ? 'pending' : ''}`}
          >
            <div className="message-header">
              <span className="username">{msg.username}</span>
              <span className="timestamp">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </span>
              {msg.pending && <span className="pending-badge">Sending...</span>}
            </div>
            <div className="message-text">{msg.text}</div>
          </div>
        ))}
      </main>

      <footer className="chat-input">
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message..."
            disabled={isSending}
          />
          <button type="submit" disabled={isSending || !inputText.trim()}>
            Send
          </button>
          <button type="button" onClick={() => sync('interaction')}>
            Refresh
          </button>
        </form>
      </footer>
    </div>
  );
}

export default App;
