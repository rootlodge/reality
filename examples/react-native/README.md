# React Native Example

Real-time chat app demonstrating Reality's React Native support.

## Key Differences from Web

Reality automatically adapts to React Native:

| Feature | Web | React Native |
|---------|-----|--------------|
| Visibility | `document.visibilityState` | `AppState` |
| Network | `navigator.onLine` | `NetInfo` |
| Focus | `window.focus` event | `AppState.change` |
| Storage | `localStorage` | `AsyncStorage` |

## Usage

The API is **identical** to web:

```tsx
import { RealityProvider, useReality, useMutation } from '@rootlodge/reality/react';

// Same provider setup
export default function App() {
  return (
    <RealityProvider
      endpoint="http://your-server.com/reality/sync"
      mode="native"
      syncOnFocus={true}
      syncOnReconnect={true}
      platform="react-native" // Only difference!
    >
      <ChatScreen />
    </RealityProvider>
  );
}

// Same hooks
function ChatScreen() {
  const { data: messages, isLoading, sync } = useReality<Message[]>(
    'chat:room:general',
    {
      fallback: [],
      fetcher: async () => {
        const res = await fetch('http://your-server.com/api/messages');
        return res.json();
      },
    }
  );

  // Same mutation hook
  const { mutate } = useMutation<Message, string>(
    'chat:room:general',
    async (text) => {
      const res = await fetch('http://your-server.com/api/messages', {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      return res.json();
    },
    {
      optimisticUpdate: (messages, text) => [
        ...messages,
        { id: 'temp', text, pending: true },
      ],
    }
  );

  // Identical JSX structure works!
}
```

## Running the Example

### 1. Start the Server

Use the server from the react-chat example:

```bash
cd ../react-chat
bun run server
```

### 2. Update the API URL

In `App.tsx`, update the `API_URL` constant with your machine's IP address:

```typescript
const API_URL = 'http://192.168.1.100:3000'; // Your IP here
```

To find your IP:
- **Windows**: `ipconfig` → Look for IPv4 Address
- **Mac**: `ifconfig | grep "inet "` → Look for 192.168.x.x
- **Linux**: `ip addr` → Look for inet

### 3. Start the App

```bash
# Install dependencies
npm install

# Start Expo
npm start

# Or directly on platform
npm run ios
npm run android
```

### 4. Test the Sync Behavior

1. Send a message → Should appear instantly (optimistic update)
2. Background the app → Come back → Should sync
3. Turn airplane mode on/off → Should sync on reconnect
4. Open the same room on web → Messages sync between platforms

## How Reality Adapts to React Native

### AppState for Visibility

```typescript
// Reality internally does this on React Native:
import { AppState } from 'react-native';

AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    // App came to foreground - sync!
    reality.syncAll();
  }
});
```

### NetInfo for Network

```typescript
// Reality uses @react-native-community/netinfo
import NetInfo from '@react-native-community/netinfo';

NetInfo.addEventListener((state) => {
  if (state.isConnected && wasDisconnected) {
    // Network restored - sync!
    reality.syncAll();
  }
});
```

## Project Structure

```
react-native/
├── App.tsx          # Main app with Reality integration
├── app.json         # Expo configuration
├── package.json     # Dependencies
└── README.md        # This file
```

## Features Demonstrated

- ✅ Real-time messaging without WebSockets
- ✅ Optimistic updates with automatic rollback
- ✅ Sync on app foreground (AppState)
- ✅ Sync on network reconnect (NetInfo)
- ✅ Loading and error states
- ✅ Multiple chat rooms
- ✅ Online user presence

## No WebSockets Required

Reality works entirely with HTTP POST requests:

```
App Foreground → POST /reality/sync → Response → Fetch if needed
```

Benefits for React Native:
- Works on all network types
- No connection management
- Simpler debugging
- Lower battery usage
- Works through all proxies/firewalls
