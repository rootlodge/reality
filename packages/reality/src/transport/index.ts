/**
 * @rootlodge/reality - Transport Module
 * 
 * Transport abstraction for Reality client.
 */

// HTTP Transport
export {
  HttpTransport,
  type ServerStatus,
} from './transport';

// Embedded Transport for SSR
export {
  EmbeddedTransport,
  SimpleEmbeddedServer,
  createSimpleEmbeddedServer,
  createAutoTransport,
  registerEmbeddedServer,
  unregisterEmbeddedServer,
  getEmbeddedServer,
  hasEmbeddedServer,
  type EmbeddedRealityServer,
} from './embedded';

// Re-export the interface from types
export type { RealityTransport } from '../types';

// Legacy export - alias HttpTransport as RealityTransport for backward compat
// Note: RealityTransport interface is now in types
import { HttpTransport } from './transport';
/** @deprecated Use HttpTransport instead */
export { HttpTransport as RealityHttpTransport };
