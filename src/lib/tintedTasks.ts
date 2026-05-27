import { arrayMove } from '@dnd-kit/sortable'

export type ThemeMode = 'light' | 'dark'

export type AccentOption = {
  name: string
  value: string
}

export type TaskCard = {
  id: string
  title: string
  content: string
  color: string
}

export type BoardColumn = {
  id: string
  name: string
  cardIds: string[]
}

export type Board = {
  id: string
  name: string
  accent: string
  parentBoardId: string | null
  createdAt: string
  updatedAt: string
  columnOrder: string[]
  columns: Record<string, BoardColumn>
  cards: Record<string, TaskCard>
}

export type PersistedState = {
  version: number
  selectedBoardId: string | null
  themeMode: ThemeMode
  boards: Board[]
}

export const APP_STORAGE_KEY = 'tinted-tasks-state-v1'
export const MIN_COLUMNS = 2
export const MAX_COLUMNS = 8

const DEFAULT_COLUMN_NAMES = [
  'Backlog',
  'Planned',
  'In Progress',
  'Review',
  'Blocked',
  'QA',
  'Done',
  'Archive',
]

export const ACCENT_OPTIONS: AccentOption[] = [
  { name: 'Tinted Green', value: '#21833a' },
  { name: 'Pine', value: '#1f8a3a' },
  { name: 'Sage', value: '#6ebc7a' },
  { name: 'Teal', value: '#1d7a66' },
  { name: 'Slate', value: '#5f6a72' },
  { name: 'Graphite', value: '#2b3236' },
]

export const CARD_COLOR_OPTIONS = [
  '#1f8a3a',
  '#2c9645',
  '#38a251',
  '#49ae61',
  '#62b978',
  '#7cc490',
  '#95cfaa',
  '#afdac1',
]

export function createInitialState(): PersistedState {
  return {
    version: 1,
    selectedBoardId: null,
    themeMode: 'light',
    boards: [],
  }
}

export function createBoard(
  name: string,
  accent: string,
  columnCount: number,
  seededCards: Array<{ columnIndex: number; title?: string; content: string }> = [],
): Board {
  const now = new Date().toISOString()
  const nextColumnCount = clamp(columnCount, MIN_COLUMNS, MAX_COLUMNS)
  const columns: Record<string, BoardColumn> = {}
  const columnOrder: string[] = []
  const cards: Record<string, TaskCard> = {}

  for (let index = 0; index < nextColumnCount; index += 1) {
    const columnId = createId('column')
    columnOrder.push(columnId)
    columns[columnId] = {
      id: columnId,
      name: DEFAULT_COLUMN_NAMES[index] ?? `Column ${index + 1}`,
      cardIds: [],
    }
  }

  for (const seededCard of seededCards) {
    const targetColumnId = columnOrder[seededCard.columnIndex]

    if (!targetColumnId) {
      continue
    }

    const cardId = createId('card')
    cards[cardId] = {
      id: cardId,
      title: seededCard.title?.trim() || deriveCardTitle(seededCard.content),
      content: seededCard.content,
      color: getRandomCardColor(),
    }
    columns[targetColumnId].cardIds.push(cardId)
  }

  return {
    id: createId('board'),
    name,
    accent,
    parentBoardId: null,
    createdAt: now,
    updatedAt: now,
    columnOrder,
    columns,
    cards,
  }
}

export function parsePersistedState(raw: string | null): PersistedState {
  if (!raw) {
    return createInitialState()
  }

  try {
    return importStateFromJson(raw) ?? createInitialState()
  } catch {
    return createInitialState()
  }
}

export function serializeState(state: PersistedState): string {
  return JSON.stringify(state)
}

export function exportStateToJson(state: PersistedState): string {
  return JSON.stringify(
    {
      ...state,
      version: 1,
    },
    null,
    2,
  )
}

export function importStateFromJson(raw: string): PersistedState | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedState>
    return parsePersistedObject(parsed)
  } catch {
    return null
  }
}

export function getBoardCardCount(board: Board): number {
  return Object.keys(board.cards).length
}

export function getBoardColumnCount(board: Board): number {
  return board.columnOrder.length
}

export function renameBoard(board: Board, name: string): Board {
  const hasVisibleCharacters = name.trim().length > 0

  return stampBoard({
    ...board,
    name: hasVisibleCharacters ? name : 'Untitled Board',
  })
}

export function recolorBoard(board: Board, accent: string): Board {
  return stampBoard({
    ...board,
    accent,
  })
}

export function renameColumn(board: Board, columnId: string, name: string): Board {
  const column = board.columns[columnId]

  if (!column) {
    return board
  }

  const hasVisibleCharacters = name.trim().length > 0

  return stampBoard({
    ...board,
    columns: {
      ...board.columns,
      [columnId]: {
        ...column,
        name: hasVisibleCharacters ? name : '',
      },
    },
  })
}

export function resizeBoardColumns(board: Board, nextCount: number): Board {
  const targetCount = clamp(nextCount, MIN_COLUMNS, MAX_COLUMNS)

  if (targetCount === board.columnOrder.length) {
    return board
  }

  if (targetCount > board.columnOrder.length) {
    const nextColumns = { ...board.columns }
    const nextColumnOrder = [...board.columnOrder]

    for (let index = board.columnOrder.length; index < targetCount; index += 1) {
      const columnId = createId('column')
      nextColumnOrder.push(columnId)
      nextColumns[columnId] = {
        id: columnId,
        name: DEFAULT_COLUMN_NAMES[index] ?? `Column ${index + 1}`,
        cardIds: [],
      }
    }

    return stampBoard({
      ...board,
      columnOrder: nextColumnOrder,
      columns: nextColumns,
    })
  }

  const retainedColumnOrder = board.columnOrder.slice(0, targetCount)
  const removedColumnOrder = board.columnOrder.slice(targetCount)
  const targetColumnId = retainedColumnOrder[retainedColumnOrder.length - 1]
  const nextColumns: Record<string, BoardColumn> = {}

  for (const columnId of retainedColumnOrder) {
    nextColumns[columnId] = {
      ...board.columns[columnId],
      cardIds: [...board.columns[columnId].cardIds],
    }
  }

  for (const removedColumnId of removedColumnOrder) {
    nextColumns[targetColumnId].cardIds.push(...board.columns[removedColumnId].cardIds)
  }

  return stampBoard({
    ...board,
    columnOrder: retainedColumnOrder,
    columns: nextColumns,
  })
}

export function addCard(
  board: Board,
  columnId: string,
  title = 'Untitled task',
  content = '',
): { board: Board; cardId: string } | null {
  const nextTitle = title.trim() || 'Untitled task'
  const nextContent = content
  const column = board.columns[columnId]

  if (!column) {
    return null
  }

  const cardId = createId('card')

  return {
    cardId,
    board: stampBoard({
      ...board,
      cards: {
        ...board.cards,
        [cardId]: {
          id: cardId,
          title: nextTitle,
          content: nextContent,
          color: getRandomCardColor(),
        },
      },
      columns: {
        ...board.columns,
        [columnId]: {
          ...column,
          cardIds: [...column.cardIds, cardId],
        },
      },
    }),
  }
}

export function updateCard(
  board: Board,
  cardId: string,
  updates: Partial<Pick<TaskCard, 'title' | 'content' | 'color'>>,
): Board {
  const card = board.cards[cardId]

  if (!card) {
    return board
  }

  const nextTitle = typeof updates.title === 'string' ? updates.title : card.title
  const nextContent = typeof updates.content === 'string' ? updates.content : card.content
  const nextColor = updates.color && isHexColor(updates.color) ? updates.color : card.color

  return stampBoard({
    ...board,
    cards: {
      ...board.cards,
      [cardId]: {
        ...card,
        title: nextTitle,
        content: nextContent,
        color: nextColor,
      },
    },
  })
}

export function deleteCard(board: Board, cardId: string): Board {
  const location = findCardLocation(board, cardId)

  if (!location) {
    return board
  }

  const nextCards = { ...board.cards }
  delete nextCards[cardId]

  return stampBoard({
    ...board,
    cards: nextCards,
    columns: {
      ...board.columns,
      [location.columnId]: {
        ...board.columns[location.columnId],
        cardIds: board.columns[location.columnId].cardIds.filter((id) => id !== cardId),
      },
    },
  })
}

export function moveCard(
  board: Board,
  cardId: string,
  fromColumnId: string,
  toColumnId: string,
  overCardId?: string,
): Board {
  const fromColumn = board.columns[fromColumnId]
  const toColumn = board.columns[toColumnId]

  if (!fromColumn || !toColumn) {
    return board
  }

  const fromIndex = fromColumn.cardIds.indexOf(cardId)

  if (fromIndex === -1) {
    return board
  }

  if (fromColumnId === toColumnId) {
    const toIndex = overCardId ? fromColumn.cardIds.indexOf(overCardId) : fromColumn.cardIds.length - 1

    if (toIndex === -1 || toIndex === fromIndex) {
      return board
    }

    return stampBoard({
      ...board,
      columns: {
        ...board.columns,
        [fromColumnId]: {
          ...fromColumn,
          cardIds: arrayMove(fromColumn.cardIds, fromIndex, toIndex),
        },
      },
    })
  }

  const nextSourceIds = fromColumn.cardIds.filter((id) => id !== cardId)
  const nextTargetIds = [...toColumn.cardIds]
  const insertIndex = overCardId ? nextTargetIds.indexOf(overCardId) : nextTargetIds.length

  if (insertIndex === -1) {
    nextTargetIds.push(cardId)
  } else {
    nextTargetIds.splice(insertIndex, 0, cardId)
  }

  return stampBoard({
    ...board,
    columns: {
      ...board.columns,
      [fromColumnId]: {
        ...fromColumn,
        cardIds: nextSourceIds,
      },
      [toColumnId]: {
        ...toColumn,
        cardIds: nextTargetIds,
      },
    },
  })
}

export function groupBoardUnderBoard(boards: Board[], sourceBoardId: string, targetBoardId: string): Board[] {
  if (sourceBoardId === targetBoardId) {
    return boards
  }

  const boardMap = new Map(boards.map((board) => [board.id, board]))
  const sourceBoard = boardMap.get(sourceBoardId)
  const targetBoard = boardMap.get(targetBoardId)

  if (!sourceBoard || !targetBoard || isBoardDescendant(boardMap, targetBoardId, sourceBoardId)) {
    return boards
  }

  return boards.map((board) =>
    board.id === sourceBoardId
      ? stampBoard({
          ...board,
          parentBoardId: targetBoardId,
        })
      : board,
  )
}

export function moveBoardToTopLevel(boards: Board[], boardId: string): Board[] {
  return boards.map((board) =>
    board.id === boardId && board.parentBoardId !== null
      ? stampBoard({
          ...board,
          parentBoardId: null,
        })
      : board,
  )
}

export function findCardLocation(board: Board, cardId: string): { columnId: string; index: number } | null {
  for (const columnId of board.columnOrder) {
    const index = board.columns[columnId].cardIds.indexOf(cardId)

    if (index >= 0) {
      return { columnId, index }
    }
  }

  return null
}

export function formatBoardDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

export function buildCardStyle(color: string): Record<string, string> {
  return {
    '--card-accent': color,
    '--card-accent-soft': hexToRgba(color, 0.22),
    '--card-accent-strong': hexToRgba(color, 0.42),
  }
}

function stampBoard(board: Board): Board {
  return {
    ...board,
    updatedAt: new Date().toISOString(),
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '')
  const expanded = normalized.length === 3
    ? normalized
        .split('')
        .map((char) => `${char}${char}`)
        .join('')
    : normalized

  const red = Number.parseInt(expanded.slice(0, 2), 16)
  const green = Number.parseInt(expanded.slice(2, 4), 16)
  const blue = Number.parseInt(expanded.slice(4, 6), 16)

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function getRandomCardColor(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const values = new Uint32Array(1)
    crypto.getRandomValues(values)
    return CARD_COLOR_OPTIONS[values[0] % CARD_COLOR_OPTIONS.length]
  }

  return CARD_COLOR_OPTIONS[Math.floor(Math.random() * CARD_COLOR_OPTIONS.length)]
}

function parsePersistedObject(parsed: Partial<PersistedState>): PersistedState | null {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null
  }

  if (typeof parsed.boards !== 'undefined' && !Array.isArray(parsed.boards)) {
    return null
  }

  if (Array.isArray(parsed.boards) && parsed.boards.some((board) => !isBoard(board))) {
    return null
  }

  const boards = Array.isArray(parsed.boards) ? parsed.boards.map(normalizeBoard) : []

  const boardIds = new Set(boards.map((board) => board.id))
  const normalizedBoards = boards.map((board) => ({
    ...board,
    parentBoardId:
      board.parentBoardId && board.parentBoardId !== board.id && boardIds.has(board.parentBoardId)
        ? board.parentBoardId
        : null,
  }))

  const selectedBoardId =
    typeof parsed.selectedBoardId === 'string' && normalizedBoards.some((board) => board.id === parsed.selectedBoardId)
      ? parsed.selectedBoardId
      : normalizedBoards[0]?.id ?? null

  return {
    version: 1,
    selectedBoardId,
    themeMode: parsed.themeMode === 'dark' ? 'dark' : 'light',
    boards: normalizedBoards,
  }
}

function normalizeBoard(board: Board): Board {
  const nextCards = Object.fromEntries(
    Object.entries(board.cards).map(([cardId, card]) => [
      cardId,
      {
        ...card,
        title:
          typeof (card as Partial<TaskCard>).title === 'string' && (card as Partial<TaskCard>).title!.trim()
            ? (card as Partial<TaskCard>).title!
            : deriveCardTitle((card as Partial<TaskCard>).content ?? ''),
        color: isHexColor((card as Partial<TaskCard>).color) ? (card as Partial<TaskCard>).color! : getRandomCardColor(),
      },
    ]),
  )

  return {
    ...board,
    parentBoardId:
      typeof (board as Partial<Board>).parentBoardId === 'string' ? (board as Partial<Board>).parentBoardId! : null,
    cards: nextCards,
  }
}

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(value)
}

function isBoard(value: unknown): value is Board {
  if (!value || typeof value !== 'object') {
    return false
  }

  const board = value as Partial<Board>

  if (
    typeof board.id !== 'string' ||
    typeof board.name !== 'string' ||
    typeof board.accent !== 'string' ||
    (typeof board.parentBoardId !== 'string' && board.parentBoardId !== null && typeof board.parentBoardId !== 'undefined') ||
    !Array.isArray(board.columnOrder) ||
    !board.columns ||
    typeof board.columns !== 'object' ||
    !board.cards ||
    typeof board.cards !== 'object'
  ) {
    return false
  }

  for (const columnId of board.columnOrder) {
    const column = board.columns[columnId]

    if (
      !column ||
      typeof column.id !== 'string' ||
      typeof column.name !== 'string' ||
      !Array.isArray(column.cardIds)
    ) {
      return false
    }
  }

  for (const card of Object.values(board.cards)) {
    if (!card || typeof card.id !== 'string' || typeof card.content !== 'string') {
      return false
    }
  }

  return true
}

function deriveCardTitle(content: string): string {
  const trimmed = content.trim()

  if (!trimmed) {
    return 'Untitled task'
  }

  const firstLine = trimmed.split(/\r?\n/, 1)[0]?.trim() ?? trimmed
  return firstLine.length > 48 ? `${firstLine.slice(0, 45).trimEnd()}...` : firstLine
}

function isBoardDescendant(
  boardMap: Map<string, Board>,
  boardId: string,
  potentialAncestorId: string,
): boolean {
  let currentBoard = boardMap.get(boardId)

  while (currentBoard?.parentBoardId) {
    if (currentBoard.parentBoardId === potentialAncestorId) {
      return true
    }

    currentBoard = boardMap.get(currentBoard.parentBoardId)
  }

  return false
}