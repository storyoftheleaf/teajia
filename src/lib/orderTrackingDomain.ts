export interface AsyncResultGuard {
  isCurrent: () => boolean;
  cancel: () => void;
}

export function createAsyncResultGuard(): AsyncResultGuard {
  let current = true;
  return {
    isCurrent: () => current,
    cancel: () => { current = false; },
  };
}
