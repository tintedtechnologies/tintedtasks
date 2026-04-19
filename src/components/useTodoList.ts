import { useCallback, useEffect, useState } from 'react'

export type TodoItem = {
  id: string
  text: string
  completed: boolean
  createdAt: string
}

export type TodoList = {
  id: string
  name: string
  items: TodoItem[]
}

const STORAGE_KEY = 'tinted-flow-todos'

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function loadLists(): TodoList[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as TodoList[]) : []
  } catch {
    return []
  }
}

export type TodoHandle = {
  lists: TodoList[]
  createList: (name: string) => void
  deleteList: (listId: string) => void
  renameList: (listId: string, name: string) => void
  addItem: (listId: string, text: string) => void
  toggleItem: (listId: string, itemId: string) => void
  deleteItem: (listId: string, itemId: string) => void
  editItem: (listId: string, itemId: string, text: string) => void
}

export function useTodoList(): TodoHandle {
  const [lists, setLists] = useState<TodoList[]>(loadLists)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lists))
    } catch {
      // Ignore storage failures
    }
  }, [lists])

  const createList = useCallback((name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setLists((prev) => [...prev, { id: generateId(), name: trimmed, items: [] }])
  }, [])

  const deleteList = useCallback((listId: string) => {
    setLists((prev) => prev.filter((l) => l.id !== listId))
  }, [])

  const renameList = useCallback((listId: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setLists((prev) => prev.map((l) => (l.id === listId ? { ...l, name: trimmed } : l)))
  }, [])

  const addItem = useCallback((listId: string, text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const item: TodoItem = {
      id: generateId(),
      text: trimmed,
      completed: false,
      createdAt: new Date().toISOString(),
    }
    setLists((prev) =>
      prev.map((l) => (l.id === listId ? { ...l, items: [...l.items, item] } : l)),
    )
  }, [])

  const toggleItem = useCallback((listId: string, itemId: string) => {
    setLists((prev) =>
      prev.map((l) =>
        l.id === listId
          ? {
              ...l,
              items: l.items.map((it) =>
                it.id === itemId ? { ...it, completed: !it.completed } : it,
              ),
            }
          : l,
      ),
    )
  }, [])

  const deleteItem = useCallback((listId: string, itemId: string) => {
    setLists((prev) =>
      prev.map((l) =>
        l.id === listId ? { ...l, items: l.items.filter((it) => it.id !== itemId) } : l,
      ),
    )
  }, [])

  const editItem = useCallback((listId: string, itemId: string, text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    setLists((prev) =>
      prev.map((l) =>
        l.id === listId
          ? {
              ...l,
              items: l.items.map((it) => (it.id === itemId ? { ...it, text: trimmed } : it)),
            }
          : l,
      ),
    )
  }, [])

  return { lists, createList, deleteList, renameList, addItem, toggleItem, deleteItem, editItem }
}
