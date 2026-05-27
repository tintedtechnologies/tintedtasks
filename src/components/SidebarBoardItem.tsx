import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { type CSSProperties } from 'react'
import { getBoardCardCount, getBoardColumnCount, type Board } from '../lib/tintedTasks'

type SidebarBoardItemProps = {
  board: Board
  canDelete: boolean
  depth: number
  isSelected: boolean
  onDelete: (boardId: string) => void
  onSelect: (boardId: string) => void
}

function SidebarBoardItem({
  board,
  canDelete,
  depth,
  isSelected,
  onDelete,
  onSelect,
}: SidebarBoardItemProps) {
  const { attributes, listeners, setNodeRef: setDraggableRef, transform, isDragging } = useDraggable({
    id: board.id,
    data: {
      type: 'board',
      boardId: board.id,
    },
  })
  const { isOver, setNodeRef: setDroppableRef } = useDroppable({
    id: `board-drop-${board.id}`,
    data: {
      type: 'board-target',
      boardId: board.id,
    },
  })

  function setNodeRef(node: HTMLElement | null) {
    setDraggableRef(node)
    setDroppableRef(node)
  }

  function stopBoardDrag(event: React.PointerEvent<HTMLButtonElement>) {
    event.stopPropagation()
  }

  return (
    <article
      {...attributes}
      {...listeners}
      className={[
        'sidebar-board-card',
        isSelected ? 'selected' : '',
        isOver && !isDragging ? 'merge-target' : '',
        isDragging ? 'dragging' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-board-depth={depth}
      data-board-name={board.name}
      ref={setNodeRef}
      role="listitem"
      style={{
        '--board-depth': depth,
        transform: CSS.Transform.toString(transform),
      } as CSSProperties}
    >
      <button
        aria-label={`Select ${board.name}`}
        className="sidebar-board-button"
        onClick={() => onSelect(board.id)}
        type="button"
      >
        <span aria-hidden="true" className="sidebar-board-accent" style={{ backgroundColor: board.accent }} />
        <span className="sidebar-board-copy">
          <strong>{board.name}</strong>
          <small>
            {getBoardColumnCount(board)} columns · {getBoardCardCount(board)} tasks
          </small>
        </span>
      </button>
      <div className="sidebar-board-actions">
        <button
          aria-label={`Delete ${board.name}`}
          className="sidebar-icon-action"
          disabled={!canDelete}
          onClick={() => onDelete(board.id)}
          onPointerDown={stopBoardDrag}
          type="button"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M9 3.75h6l.75 1.5H20.25v1.5h-1.5v12a2.25 2.25 0 0 1-2.25 2.25h-9A2.25 2.25 0 0 1 5.25 18.75v-12h-1.5v-1.5h4.5Zm-2.25 3v12a.75.75 0 0 0 .75.75h9a.75.75 0 0 0 .75-.75v-12Zm3 2.25h1.5v7.5h-1.5Zm3 0h1.5v7.5h-1.5Z" fill="currentColor" />
          </svg>
          <span className="sr-only">Delete board</span>
        </button>
      </div>
    </article>
  )
}

export default SidebarBoardItem