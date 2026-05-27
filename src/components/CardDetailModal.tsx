import { useRef } from 'react'
import { type TaskCard } from '../lib/tintedTasks'
import { useDialogFocusTrap } from './useDialogFocusTrap'

type CardUpdates = Partial<Pick<TaskCard, 'title' | 'content' | 'color'>>

type CardDetailModalProps = {
  card: TaskCard | null
  columnName: string | null
  isOpen: boolean
  onClose: () => void
  onUpdateCard: (cardId: string, updates: CardUpdates) => void
  onDeleteCard: (cardId: string) => void
}

function CardDetailModal({
  card,
  columnName,
  isOpen,
  onClose,
  onUpdateCard,
  onDeleteCard,
}: CardDetailModalProps) {
  const titleInputRef = useRef<HTMLInputElement | null>(null)
  const dialogRef = useDialogFocusTrap({
    isOpen,
    initialFocusRef: titleInputRef,
  })

  if (!isOpen || !card) {
    return null
  }

  return (
    <div className="settings-backdrop" onClick={onClose}>
      <section
        aria-labelledby="card-detail-title"
        aria-modal="true"
        className="card-detail-modal"
        onClick={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="card-detail-header">
          <div>
            <p className="eyebrow">Task detail</p>
            <h2 id="card-detail-title">Edit task</h2>
            <p className="card-detail-meta">{columnName ? `Column: ${columnName}` : 'Board task'}</p>
          </div>
          <button className="ghost-action" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="card-detail-toolbar">
          <label className="card-color-picker card-detail-color" title="Card color">
            <input
              aria-label="Change task color"
              onChange={(event) => onUpdateCard(card.id, { color: event.target.value })}
              type="color"
              value={card.color}
            />
            <span aria-hidden="true" className="card-color-picker-chip" />
          </label>
          <button className="icon-action" onClick={() => onDeleteCard(card.id)} type="button">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M9 3.75h6l.75 1.5H20.25v1.5h-1.5v12a2.25 2.25 0 0 1-2.25 2.25h-9A2.25 2.25 0 0 1 5.25 18.75v-12h-1.5v-1.5h4.5Zm-2.25 3v12a.75.75 0 0 0 .75.75h9a.75.75 0 0 0 .75-.75v-12Zm3 2.25h1.5v7.5h-1.5Zm3 0h1.5v7.5h-1.5Z" fill="currentColor" />
            </svg>
            <span className="sr-only">Delete task</span>
          </button>
        </div>

        <label className="sr-only" htmlFor="card-detail-title-input">
          Edit task title
        </label>
        <input
          className="card-detail-title-input"
          id="card-detail-title-input"
          onChange={(event) => onUpdateCard(card.id, { title: event.target.value })}
          onKeyDown={(event) => event.stopPropagation()}
          ref={titleInputRef}
          type="text"
          value={card.title}
        />

        <label className="sr-only" htmlFor="card-detail-editor">
          Edit task details
        </label>
        <textarea
          className="card-detail-editor"
          id="card-detail-editor"
          onChange={(event) => onUpdateCard(card.id, { content: event.target.value })}
          onKeyDown={(event) => event.stopPropagation()}
          rows={14}
          value={card.content}
        />
      </section>
    </div>
  )
}

export default CardDetailModal