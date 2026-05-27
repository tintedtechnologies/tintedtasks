import { useDroppable } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEffect, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { buildCardStyle, type BoardColumn, type TaskCard } from '../lib/tintedTasks'

type CardUpdates = Partial<Pick<TaskCard, 'title' | 'content' | 'color'>>

type BoardColumnViewProps = {
  column: BoardColumn
  cards: TaskCard[]
  onRenameColumn: (value: string) => void
  onAddCard: (columnId: string) => void
  onOpenCard: (cardId: string) => void
  pendingFocusCardId: string | null
  onPendingFocusHandled: (cardId: string) => void
  onUpdateCard: (cardId: string, updates: CardUpdates) => void
  onDeleteCard: (cardId: string) => void
}

type TaskCardViewProps = {
  autoFocus: boolean
  card: TaskCard
  columnId: string
  onExpand: () => void
  onAutoFocusHandled: (cardId: string) => void
  onUpdateCard: (cardId: string, updates: CardUpdates) => void
  onDelete: () => void
}

function stopEditorKeydown(event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
  event.stopPropagation()
}

function TaskCardView({
  autoFocus,
  card,
  columnId,
  onExpand,
  onAutoFocusHandled,
  onUpdateCard,
  onDelete,
}: TaskCardViewProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: {
      type: 'card',
      columnId,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...buildCardStyle(card.color),
  } as CSSProperties

  useEffect(() => {
    if (autoFocus) {
      onAutoFocusHandled(card.id)
    }
  }, [autoFocus, card.id, onAutoFocusHandled])

  return (
    <article
      {...attributes}
      {...listeners}
      aria-label={card.title ? `Drag card: ${card.title}` : 'Drag card'}
      className={isDragging ? 'task-card dragging' : 'task-card'}
      ref={setNodeRef}
      style={style}
    >
      <div className="task-card-toolbar">
        <div className="card-kicker">
          <span aria-hidden="true" className="card-swatch" />
          <span className="card-kicker-label">Task</span>
        </div>

        <div className="card-actions">
          <button aria-label={`Open ${card.title}`} className="icon-action expand-card-action" onClick={onExpand} type="button">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M8.25 6.75h9v1.5h-6.44l7.22 7.22-1.06 1.06-7.22-7.22v6.44h-1.5v-9Z" fill="currentColor" />
            </svg>
            <span className="sr-only">Open details</span>
          </button>
          <label className="card-color-picker" title="Card color">
            <input
              aria-label={`Change color for ${card.title}`}
              onChange={(event) => onUpdateCard(card.id, { color: event.target.value })}
              type="color"
              value={card.color}
            />
            <span aria-hidden="true" className="card-color-picker-chip" />
          </label>
          <button aria-label={`Delete ${card.title}`} className="icon-action" onClick={onDelete} type="button">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M9 3.75h6l.75 1.5H20.25v1.5h-1.5v12a2.25 2.25 0 0 1-2.25 2.25h-9A2.25 2.25 0 0 1 5.25 18.75v-12h-1.5v-1.5h4.5Zm-2.25 3v12a.75.75 0 0 0 .75.75h9a.75.75 0 0 0 .75-.75v-12Zm3 2.25h1.5v7.5h-1.5Zm3 0h1.5v7.5h-1.5Z" fill="currentColor" />
            </svg>
            <span className="sr-only">Delete</span>
          </button>
        </div>
      </div>

      <label className="sr-only" htmlFor={`card-title-${card.id}`}>
        Rename {card.title}
      </label>
      <input
        autoFocus={autoFocus}
        className="card-title-input"
        id={`card-title-${card.id}`}
        onChange={(event) => onUpdateCard(card.id, { title: event.target.value })}
        onKeyDown={stopEditorKeydown}
        onPointerDown={(event) => event.stopPropagation()}
        type="text"
        value={card.title}
      />
    </article>
  )
}

function BoardColumnView({
  column,
  cards,
  onRenameColumn,
  onAddCard,
  onOpenCard,
  pendingFocusCardId,
  onPendingFocusHandled,
  onUpdateCard,
  onDeleteCard,
}: BoardColumnViewProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: column.id,
    data: {
      type: 'column',
      columnId: column.id,
    },
  })

  function commitColumnName(nextName: string) {
    if (nextName !== column.name) {
      onRenameColumn(nextName)
    }
  }

  function handleColumnNameKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    stopEditorKeydown(event)

    if (event.key === 'Enter') {
      event.preventDefault()
      commitColumnName(event.currentTarget.value)
      event.currentTarget.blur()
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      event.currentTarget.value = column.name
      event.currentTarget.blur()
    }
  }

  return (
    <section className={isOver ? 'board-column is-over' : 'board-column'}>
      <div className="column-header">
        <div className="column-header-main">
          <input
            aria-label={`Rename ${column.name}`}
            className="column-name-input"
            defaultValue={column.name}
            key={`${column.id}:${column.name}`}
            onBlur={(event) => commitColumnName(event.currentTarget.value)}
            onKeyDown={handleColumnNameKeyDown}
            onKeyDownCapture={stopEditorKeydown}
            onPointerDown={(event) => event.stopPropagation()}
            type="text"
          />
          <button
            aria-label={`Add card to ${column.name}`}
            className="column-inline-add"
            onClick={() => onAddCard(column.id)}
            type="button"
          >
            <span aria-hidden="true" className="column-inline-add-icon">
              <svg viewBox="0 0 24 24">
                <path d="M11.25 5.25h1.5v5.25H18v1.5h-5.25v5.25h-1.5V12H6v-1.5h5.25V5.25Z" fill="currentColor" />
              </svg>
            </span>
            <span>Add task</span>
          </button>
        </div>
        <span className="column-count">{cards.length}</span>
      </div>

      <div className="column-dropzone" ref={setNodeRef}>
        <SortableContext items={column.cardIds} strategy={rectSortingStrategy}>
          <div className="card-stack">
            {cards.length === 0 ? <p className="empty-column">Drop a card here or add one.</p> : null}
            {cards.map((card) => (
              <TaskCardView
                autoFocus={pendingFocusCardId === card.id}
                card={card}
                columnId={column.id}
                key={card.id}
                onAutoFocusHandled={onPendingFocusHandled}
                onDelete={() => onDeleteCard(card.id)}
                onExpand={() => onOpenCard(card.id)}
                onUpdateCard={onUpdateCard}
              />
            ))}
          </div>
        </SortableContext>
      </div>
    </section>
  )
}

export default BoardColumnView