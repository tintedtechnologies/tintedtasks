import { type CSSProperties } from 'react'
import { buildCardStyle, type TaskCard } from '../lib/tintedTasks'

type CardPreviewProps = {
  card: TaskCard
  size: { width: number; height: number } | null
}

function CardPreview({ card, size }: CardPreviewProps) {
  return (
    <article
      className="task-card preview-card"
      style={{
        ...buildCardStyle(card.color),
        width: size?.width ? `${size.width}px` : undefined,
        minHeight: size?.height ? `${size.height}px` : undefined,
      } as CSSProperties}
    >
      <div className="task-card-toolbar">
        <div className="card-kicker">
          <span aria-hidden="true" className="card-swatch" />
          <span className="card-kicker-label">Task</span>
        </div>
        <div className="card-actions preview-actions" aria-hidden="true">
          <span className="icon-action preview-token" />
          <span className="card-color-picker preview-token">
            <span className="card-color-picker-chip" />
          </span>
          <span className="icon-action preview-token" />
        </div>
      </div>
      <input className="card-title-input preview-title-input" readOnly type="text" value={card.title} />
    </article>
  )
}

export default CardPreview