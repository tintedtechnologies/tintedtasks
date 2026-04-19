import { useEffect, useState } from 'react'
import { useDialogFocusTrap } from './useDialogFocusTrap'
import { type TodoHandle, type TodoItem, type TodoList } from './useTodoList'

type TodoModalProps = {
  isOpen: boolean
  onClose: () => void
  todo: TodoHandle
}

function TodoModal({ isOpen, onClose, todo }: TodoModalProps) {
  const { lists, createList, deleteList, renameList, addItem, toggleItem, deleteItem, editItem } =
    todo
  const dialogRef = useDialogFocusTrap({ isOpen })

  const [activeListId, setActiveListId] = useState<string | null>(null)
  const [newListName, setNewListName] = useState('')
  const [newItemText, setNewItemText] = useState('')
  const [editingItem, setEditingItem] = useState<{
    listId: string
    itemId: string
    text: string
  } | null>(null)
  const [editingListId, setEditingListId] = useState<string | null>(null)
  const [editingListName, setEditingListName] = useState('')

  // Keep active list in sync when lists change
  useEffect(() => {
    if (!activeListId && lists.length > 0) {
      setActiveListId(lists[0].id)
    } else if (activeListId && !lists.find((l) => l.id === activeListId)) {
      setActiveListId(lists[0]?.id ?? null)
    }
  }, [lists, activeListId])

  if (!isOpen) return null

  const activeList: TodoList | null = lists.find((l) => l.id === activeListId) ?? lists[0] ?? null
  const completedCount = activeList ? activeList.items.filter((i) => i.completed).length : 0

  function handleCreateList(e: React.FormEvent) {
    e.preventDefault()
    if (!newListName.trim()) return
    createList(newListName)
    setNewListName('')
  }

  function handleAddItem(e: React.FormEvent) {
    e.preventDefault()
    if (!activeList || !newItemText.trim()) return
    addItem(activeList.id, newItemText)
    setNewItemText('')
  }

  function handleStartEditItem(item: TodoItem) {
    if (!activeList) return
    setEditingItem({ listId: activeList.id, itemId: item.id, text: item.text })
  }

  function handleCommitEditItem() {
    if (editingItem) {
      editItem(editingItem.listId, editingItem.itemId, editingItem.text)
      setEditingItem(null)
    }
  }

  function handleStartRenameList(list: TodoList) {
    setEditingListId(list.id)
    setEditingListName(list.name)
  }

  function handleCommitRenameList() {
    if (editingListId) {
      renameList(editingListId, editingListName)
    }
    setEditingListId(null)
    setEditingListName('')
  }

  function handleDeleteList(list: TodoList) {
    deleteList(list.id)
  }

  return (
    <div className="todo-backdrop" onClick={onClose}>
      <section
        aria-labelledby="todo-title"
        aria-modal="true"
        className="todo-dialog"
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="todo-header">
          <div>
            <p className="eyebrow">Tasks</p>
            <h2 id="todo-title">To-Do Lists</h2>
          </div>
          <button
            aria-label="Close to-do lists"
            className="ghost-action"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <div className="todo-body">
          {/* Left panel: list of lists */}
          <aside className="todo-lists-panel">
            <p className="todo-panel-eyebrow eyebrow">Lists</p>

            {lists.length === 0 ? (
              <p className="panel-note todo-empty-hint">No lists yet.</p>
            ) : (
              <ul className="todo-lists-nav" role="list">
                {lists.map((list) => (
                  <li key={list.id} className="todo-list-nav-item">
                    <button
                      className="todo-list-tab"
                      data-active={list.id === activeList?.id}
                      onClick={() => setActiveListId(list.id)}
                      type="button"
                    >
                      <span className="todo-list-tab-name">{list.name}</span>
                      <span className="todo-list-tab-count">
                        {list.items.filter((i) => !i.completed).length}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <form className="todo-new-list-form" onSubmit={handleCreateList}>
              <input
                aria-label="New list name"
                className="todo-text-input"
                placeholder="New list…"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
              />
              <button
                aria-label="Create list"
                className="todo-icon-btn"
                type="submit"
              >
                +
              </button>
            </form>
          </aside>

          {/* Right panel: items in active list */}
          <div className="todo-items-panel">
            {activeList ? (
              <>
                <div className="todo-items-header">
                  {editingListId === activeList.id ? (
                    <input
                      autoFocus
                      className="todo-text-input todo-list-rename-input"
                      value={editingListName}
                      onBlur={handleCommitRenameList}
                      onChange={(e) => setEditingListName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleCommitRenameList()
                        }
                        if (e.key === 'Escape') setEditingListId(null)
                      }}
                    />
                  ) : (
                    <button
                      className="todo-list-title-btn"
                      onClick={() => handleStartRenameList(activeList)}
                      title="Click to rename"
                      type="button"
                    >
                      {activeList.name}
                    </button>
                  )}

                  <span className="panel-note todo-progress">
                    {completedCount}/{activeList.items.length} done
                  </span>

                  <button
                    aria-label={`Delete list ${activeList.name}`}
                    className="ghost-action todo-delete-list-btn"
                    onClick={() => handleDeleteList(activeList)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>

                {activeList.items.length === 0 ? (
                  <p className="panel-note todo-empty-note">No tasks yet — add one below.</p>
                ) : (
                  <ul className="todo-item-list" role="list">
                    {activeList.items.map((item) => (
                      <li key={item.id} className="todo-item" data-completed={item.completed}>
                        <button
                          aria-label={item.completed ? 'Mark incomplete' : 'Mark complete'}
                          aria-pressed={item.completed}
                          className="todo-check-btn"
                          onClick={() => toggleItem(activeList.id, item.id)}
                          type="button"
                        >
                          <span className="todo-check-icon" aria-hidden="true">
                            {item.completed ? '✓' : ''}
                          </span>
                        </button>

                        {editingItem?.itemId === item.id ? (
                          <input
                            autoFocus
                            className="todo-text-input todo-item-edit-input"
                            value={editingItem.text}
                            onBlur={handleCommitEditItem}
                            onChange={(e) =>
                              setEditingItem({ ...editingItem, text: e.target.value })
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                handleCommitEditItem()
                              }
                              if (e.key === 'Escape') setEditingItem(null)
                            }}
                          />
                        ) : (
                          <span
                            className="todo-item-text"
                            onDoubleClick={() => handleStartEditItem(item)}
                            title="Double-click to edit"
                          >
                            {item.text}
                          </span>
                        )}

                        <button
                          aria-label={`Delete task: ${item.text}`}
                          className="todo-item-delete-btn"
                          onClick={() => deleteItem(activeList.id, item.id)}
                          type="button"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <form className="todo-add-item-form" onSubmit={handleAddItem}>
                  <input
                    aria-label="New task"
                    className="todo-text-input"
                    placeholder="Add a task…"
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                  />
                  <button aria-label="Add task" className="todo-icon-btn" type="submit">
                    +
                  </button>
                </form>
              </>
            ) : (
              <div className="todo-no-list">
                <p className="panel-note">Create a list on the left to get started.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

export default TodoModal
