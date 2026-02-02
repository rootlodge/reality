import { RealityEvent } from '../core/event';

export interface RealityTransport {
  sendFilter(filter: string): Promise<{ events: RealityEvent[]; serverFilter: string }>;
  sendEvents(events: RealityEvent[]): Promise<{ added: number }>;
}

export class HttpTransport implements RealityTransport {
  constructor(private url: string) {}

  async sendFilter(filter: string): Promise<{ events: RealityEvent[]; serverFilter: string }> {
    const res = await fetch(`${this.url}/filter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filter,
        origin: 'client', // TODO: Client ID
      }),
    });
    
    if (!res.ok) throw new Error(`Reality Sync Error: ${res.status}`);
    return res.json();
  }

  async sendEvents(events: RealityEvent[]): Promise<{ added: number }> {
    const res = await fetch(`${this.url}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events,
        origin: 'client',
      }),
    });

    if (!res.ok) throw new Error(`Reality Push Error: ${res.status}`);
    return res.json();
  }
}
