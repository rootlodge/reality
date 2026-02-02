import { R as RealityClient, a as RealityClientOptions } from '../createClient-BLSjeI16.js';
import { R as RealityEvent } from '../event-YpV_QVIZ.js';
import 'eventemitter3';
import 'zod';

declare function useRealityClient(options?: RealityClientOptions): RealityClient | null;
declare function useReality(topic: string, clientOverride?: RealityClient): {
    events: RealityEvent<unknown>[];
    publish: (payload: unknown) => void;
};

export { useReality, useRealityClient };
