# Reality Explained Simply

## What Problem Does Reality Solve?

**The Short Version:** Reality makes your app update in real-time without the headaches of WebSockets.

## The Problem with Existing Solutions

### WebSockets
Think of WebSockets like a phone call - you dial in and stay connected. This works great, but:
- Someone has to manage that phone line the whole time
- If you have 10,000 users, that's 10,000 open phone lines
- If your server restarts, everyone gets disconnected
- Some corporate firewalls block these "calls"

### Server-Sent Events (SSE)
SSE is like a one-way radio broadcast - the server talks, clients listen. But:
- Still keeps a connection open
- Still needs to track who's listening
- Still has scaling headaches

### Polling
Polling is like checking your mailbox every 5 seconds. Simple, but:
- You walk to the mailbox even when there's no mail
- Wastes energy (bandwidth) constantly
- Either too slow or too wasteful

## How Reality Works

Reality is like having a really smart mailbox that:
1. Knows if there's new mail before you walk over
2. Only makes you get up when something actually arrived
3. Checks automatically when you come home (focus on the tab)

```
┌─────────────────────────────────────────────────────────────────┐
│                        YOUR APP                                  │
│                                                                  │
│   You're reading messages                                        │
│   ─────────────────────                                          │
│                                                                  │
│   Messages: [Hello, Hi there, How are you?]  ← You see this     │
│                                                                  │
│   You switch to another tab to check email...                    │
│                                                                  │
│   Meanwhile, your friend sends a message!                        │
│                                                                  │
│   You switch back to the chat tab...                             │
│                                                                  │
│   Reality: "Hmm, the version changed from 3 to 4!"               │
│   Reality: "Let me fetch the new messages..."                    │
│                                                                  │
│   Messages: [Hello, Hi there, How are you?, Miss you!]           │
│             ↑ Updated instantly when you came back!              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## The Magic: Version Numbers

Reality uses a simple trick - **version numbers**:

1. Server keeps track: "Chat room messages are at version 5"
2. Your browser remembers: "Last I checked, it was version 5"
3. When you focus the tab, browser asks: "Is it still version 5?"
4. Server says either:
   - "Yep, still 5" → Nothing happens (fast!)
   - "Nope, it's 6 now" → Browser fetches new messages

**That's it!** No open connections. No constant polling. Just clever version checking.

## Why This Matters

### For Users
- App still feels real-time
- Works everywhere (no firewall issues)
- Less battery drain on mobile

### For Developers
- No WebSocket server to manage
- Easy to scale (just add more servers)
- Works with any hosting (Vercel, Netlify, AWS, anywhere)

### For Ops/DevOps
- No sticky sessions needed
- Standard HTTP load balancing
- No special infrastructure

## When Does It Update?

Reality syncs when:
1. **Page loads** - Initial data
2. **Tab gets focus** - "Welcome back, let me check for updates"
3. **Network reconnects** - Phone was on airplane mode, now it's back
4. **After you do something** - You sent a message, let's verify it went through
5. **Manual refresh** - You clicked the refresh button

## Real Code Example

```typescript
// This is all you need in your React app:

function Chat() {
  // Subscribe to chat messages
  const { data: messages } = useReality('chat:room:general', {
    fetcher: () => fetch('/api/messages').then(r => r.json()),
  });

  // Send a message
  const { mutate: sendMessage } = useMutation(
    'chat:room:general',
    (text) => fetch('/api/messages', { method: 'POST', body: text })
  );

  return (
    <div>
      {messages.map(m => <p>{m.text}</p>)}
      <button onClick={() => sendMessage('Hello!')}>Send</button>
    </div>
  );
}
```

That's it! No WebSocket setup. No connection management. It just works.

## Visual Comparison

```
┌─────────────────────────────────────────────────────────────────┐
│                     WEBSOCKETS                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Client ════════════════════════════════════════════ Server    │
│          (connection stays open the entire time)                │
│                                                                  │
│   Memory per client: HIGH                                        │
│   Scaling: HARD                                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      POLLING                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Client ───request───► Server                                   │
│          ◄──response───                                          │
│          ───request───►         (every 2 seconds, forever)      │
│          ◄──response───                                          │
│          ───request───►                                          │
│          ◄──response───                                          │
│                                                                  │
│   Wasted requests: MANY                                          │
│   Bandwidth: HIGH                                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      REALITY                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Tab focused → "Is version still 5?" → "Yes" → Done! (fast)    │
│                                                                  │
│   Tab focused → "Is version still 5?" → "No, it's 6"            │
│              → Fetch new data → Update UI                       │
│                                                                  │
│   Wasted requests: MINIMAL                                       │
│   Bandwidth: LOW                                                 │
│   Connections: NONE (just regular HTTP)                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## FAQ

**Q: Is it really "real-time"?**

For most apps, yes! Updates appear when you're actively using the app. If you need updates while in a different tab (like a trading app), Reality might not be the best fit.

**Q: What if I need instant updates?**

Reality updates instantly when you return to the tab or after you take an action. For truly instant push notifications while in another tab, you might want to combine Reality with something like web push notifications.

**Q: Is it hard to set up?**

Nope! If you can use `fetch()`, you can use Reality. No WebSocket servers, no special infrastructure.

**Q: Does it work with React Native?**

Yes! Same code works on mobile, using `AppState` instead of tab focus.

## Summary

Reality = Real-time feeling without real-time headaches.

- ✅ No persistent connections
- ✅ No WebSocket servers
- ✅ Works everywhere HTTP works
- ✅ Easy to scale
- ✅ Feels instant to users
