import { APP_STORAGE_KEY, parsePersistedState, serializeState, type PersistedState } from './tintedTasks'

export type StorageMode = 'local' | 'memory'

export type PersistedAppStateResult = {
  state: PersistedState
  storageMode: StorageMode
}

export function loadPersistedAppState(): PersistedAppStateResult {
  if (typeof window === 'undefined') {
    return {
      state: parsePersistedState(null),
      storageMode: 'memory',
    }
  }

  try {
    return {
      state: parsePersistedState(window.localStorage.getItem(APP_STORAGE_KEY)),
      storageMode: 'local',
    }
  } catch {
    return {
      state: parsePersistedState(null),
      storageMode: 'memory',
    }
  }
}

export function persistAppState(state: PersistedState): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    window.localStorage.setItem(APP_STORAGE_KEY, serializeState(state))
    return true
  } catch {
    return false
  }
}

export function clearPersistedAppState(extraKeys: string[] = []): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    window.localStorage.removeItem(APP_STORAGE_KEY)

    for (const key of extraKeys) {
      window.localStorage.removeItem(key)
    }

    return true
  } catch {
    return false
  }
}