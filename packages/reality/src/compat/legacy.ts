// Legacy compatibility layer for v1
// Reality 2.0 is a rewrite, so these are mocks/no-ops or simple wrappers

export const SyncHintSchema = {
  enum: () => ['interaction', 'poll']
};

export const RealityModeSchema = {
  enum: () => ['native']
};

// ... add more if applications break during migration ...
