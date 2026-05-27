import { describe, expect, it } from 'vitest'
import {
  ACCENT_OPTIONS,
  addCard,
  createInitialState,
  createBoard,
  exportStateToJson,
  findCardLocation,
  getBoardCardCount,
  groupBoardUnderBoard,
  importStateFromJson,
  moveBoardToTopLevel,
  moveCard,
  resizeBoardColumns,
} from './tintedTasks'

describe('tintedTasks smoke flows', () => {
  it('starts with an empty light workspace by default', () => {
    const state = createInitialState()

    expect(state.themeMode).toBe('light')
    expect(state.selectedBoardId).toBeNull()
    expect(state.boards).toHaveLength(0)
  })

  it('creates a board with the requested columns and seeded cards', () => {
    const board = createBoard('Launch board', ACCENT_OPTIONS[0].value, 4, [
      { columnIndex: 0, content: 'Draft launch brief' },
      { columnIndex: 3, title: 'Ship it', content: 'Publish release notes' },
    ])

    expect(board.name).toBe('Launch board')
    expect(board.columnOrder).toHaveLength(4)
    expect(getBoardCardCount(board)).toBe(2)
    expect(board.columns[board.columnOrder[0]].cardIds).toHaveLength(1)
    expect(board.columns[board.columnOrder[3]].cardIds).toHaveLength(1)
  })

  it('adds a card into the selected column', () => {
    const board = createBoard('Card board', ACCENT_OPTIONS[1].value, 3)
    const targetColumnId = board.columnOrder[1]
    const result = addCard(board, targetColumnId, 'New task', 'Write test coverage')

    expect(result).not.toBeNull()

    if (!result) {
      return
    }

    expect(result.board.columns[targetColumnId].cardIds).toContain(result.cardId)
    expect(result.board.cards[result.cardId].title).toBe('New task')
    expect(result.board.cards[result.cardId].content).toBe('Write test coverage')
    expect(getBoardCardCount(result.board)).toBe(1)
  })

  it('moves a card between columns', () => {
    const board = createBoard('Move board', ACCENT_OPTIONS[2].value, 3)
    const sourceColumnId = board.columnOrder[0]
    const destinationColumnId = board.columnOrder[2]
    const created = addCard(board, sourceColumnId, 'Dragged task', 'Move across the board')

    expect(created).not.toBeNull()

    if (!created) {
      return
    }

    const movedBoard = moveCard(created.board, created.cardId, sourceColumnId, destinationColumnId)
    const location = findCardLocation(movedBoard, created.cardId)

    expect(location).not.toBeNull()
    expect(location?.columnId).toBe(destinationColumnId)
    expect(movedBoard.columns[sourceColumnId].cardIds).not.toContain(created.cardId)
    expect(movedBoard.columns[destinationColumnId].cardIds).toContain(created.cardId)
  })

  it('carries cards into the last retained column when shrinking columns', () => {
    const board = createBoard('Resize board', ACCENT_OPTIONS[3].value, 4, [
      { columnIndex: 2, content: 'Validate migration' },
      { columnIndex: 3, content: 'Confirm rollout' },
    ])

    const resizedBoard = resizeBoardColumns(board, 2)
    const lastRetainedColumnId = resizedBoard.columnOrder[1]

    expect(resizedBoard.columnOrder).toHaveLength(2)
    expect(resizedBoard.columns[lastRetainedColumnId].cardIds).toHaveLength(2)
    expect(getBoardCardCount(resizedBoard)).toBe(2)
  })

  it('exports and re-imports state as JSON', () => {
    const board = createBoard('Backup board', ACCENT_OPTIONS[0].value, 3, [
      { columnIndex: 0, content: 'Capture backup' },
    ])
    const childBoard = {
      ...createBoard('Nested board', ACCENT_OPTIONS[1].value, 2),
      parentBoardId: board.id,
    }
    const json = exportStateToJson({
      version: 1,
      boards: [board, childBoard],
      selectedBoardId: board.id,
      themeMode: 'dark',
    })
    const restored = importStateFromJson(json)

    expect(restored).not.toBeNull()
    expect(restored?.boards).toHaveLength(2)
    expect(restored?.boards[0].name).toBe('Backup board')
    expect(restored?.boards[1].parentBoardId).toBe(board.id)
    expect(restored?.themeMode).toBe('dark')
  })

  it('rejects invalid JSON backups', () => {
    expect(importStateFromJson('{"boards":[{}]}')).toBeNull()
    expect(importStateFromJson('not-json')).toBeNull()
  })

  it('groups one board underneath another without changing its cards', () => {
    const targetBoard = createBoard('Target board', ACCENT_OPTIONS[0].value, 3)
    const sourceBoard = createBoard('Source board', ACCENT_OPTIONS[1].value, 2, [
      { columnIndex: 0, content: 'Source task one' },
    ])

    const groupedBoards = groupBoardUnderBoard([targetBoard, sourceBoard], sourceBoard.id, targetBoard.id)
    const groupedSource = groupedBoards.find((board) => board.id === sourceBoard.id)

    expect(groupedSource?.parentBoardId).toBe(targetBoard.id)
    expect(groupedSource && getBoardCardCount(groupedSource)).toBe(1)
  })

  it('does not allow creating a nested cycle', () => {
    const parentBoard = createBoard('Parent board', ACCENT_OPTIONS[2].value, 3)
    const childBoard = {
      ...createBoard('Child board', ACCENT_OPTIONS[3].value, 2),
      parentBoardId: parentBoard.id,
    }

    const regroupedBoards = groupBoardUnderBoard([parentBoard, childBoard], parentBoard.id, childBoard.id)
    const regroupedParent = regroupedBoards.find((board) => board.id === parentBoard.id)

    expect(regroupedParent?.parentBoardId).toBeNull()
  })

  it('moves a nested board back to the top level', () => {
    const parentBoard = createBoard('Parent board', ACCENT_OPTIONS[0].value, 3)
    const childBoard = {
      ...createBoard('Child board', ACCENT_OPTIONS[1].value, 2),
      parentBoardId: parentBoard.id,
    }

    const ungroupedBoards = moveBoardToTopLevel([parentBoard, childBoard], childBoard.id)
    const ungroupedChild = ungroupedBoards.find((board) => board.id === childBoard.id)

    expect(ungroupedChild?.parentBoardId).toBeNull()
  })
})