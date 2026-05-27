import { afterEach, describe, expect, it } from 'vitest'
import { APP_STORAGE_KEY, ACCENT_OPTIONS, createBoard, type PersistedState } from './tintedTasks'
import { clearPersistedAppState, loadPersistedAppState, persistAppState } from './persistence'

const originalWindow = globalThis.window

function createState(): PersistedState {
  const board = createBoard('Persisted board', ACCENT_OPTIONS[0].value, 4)

  return {
    version: 1,
    selectedBoardId: board.id,
    themeMode: 'light',
    boards: [board],
  }
}

function setWindowMock(storage: Storage) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: storage,
      matchMedia: () => ({
        matches: false,
        media: '',
        onchange: null,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        dispatchEvent() {
          return false
        },
      }),
    },
  })
}

afterEach(() => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: originalWindow,
  })
})

describe('persistence smoke flows', () => {
  it('persists and reloads application state from localStorage', () => {
    const storage = new Map<string, string>()

    setWindowMock({
      clear() {
        storage.clear()
      },
      getItem(key) {
        return storage.get(key) ?? null
      },
      key(index) {
        return Array.from(storage.keys())[index] ?? null
      },
      get length() {
        return storage.size
      },
      removeItem(key) {
        storage.delete(key)
      },
      setItem(key, value) {
        storage.set(key, value)
      },
    })

    const state = createState()

    expect(persistAppState(state)).toBe(true)
    expect(storage.has(APP_STORAGE_KEY)).toBe(true)

    const loaded = loadPersistedAppState()

    expect(loaded.storageMode).toBe('local')
    expect(loaded.state.selectedBoardId).toBe(state.selectedBoardId)
    expect(loaded.state.boards).toHaveLength(1)
    expect(loaded.state.boards[0].name).toBe('Persisted board')
  })

  it('falls back to memory mode when localStorage is unavailable', () => {
    setWindowMock({
      clear() {
        throw new Error('unavailable')
      },
      getItem() {
        throw new Error('unavailable')
      },
      key() {
        return null
      },
      get length() {
        return 0
      },
      removeItem() {
        throw new Error('unavailable')
      },
      setItem() {
        throw new Error('unavailable')
      },
    })

    const loaded = loadPersistedAppState()

    expect(loaded.storageMode).toBe('memory')
    expect(loaded.state.selectedBoardId).toBeNull()
    expect(loaded.state.boards).toHaveLength(0)
    expect(persistAppState(createState())).toBe(false)
  })

  it('can clear the saved local workspace data', () => {
    const storage = new Map<string, string>()

    setWindowMock({
      clear() {
        storage.clear()
      },
      getItem(key) {
        return storage.get(key) ?? null
      },
      key(index) {
        return Array.from(storage.keys())[index] ?? null
      },
      get length() {
        return storage.size
      },
      removeItem(key) {
        storage.delete(key)
      },
      setItem(key, value) {
        storage.set(key, value)
      },
    })

    expect(persistAppState(createState())).toBe(true)
    expect(storage.has(APP_STORAGE_KEY)).toBe(true)
    expect(clearPersistedAppState()).toBe(true)
    expect(storage.has(APP_STORAGE_KEY)).toBe(false)
  })
})