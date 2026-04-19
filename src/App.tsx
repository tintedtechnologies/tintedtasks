import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import './App.css'
import BoardColumnView from './components/BoardColumnView'
import CardDetailModal from './components/CardDetailModal'
import CardPreview from './components/CardPreview'
import SidebarBoardItem from './components/SidebarBoardItem'
import SettingsModal from './components/SettingsModal'
import PomodoroModal from './components/PomodoroModal'
import TodoModal from './components/TodoModal'
import { usePomodoroTimer, formatTime, phaseLabel } from './components/usePomodoroTimer'
import { useTodoList } from './components/useTodoList'
import {
  clearPersistedAppState,
  loadPersistedAppState,
  persistAppState,
  type StorageMode,
} from './lib/persistence'
import {
  ACCENT_OPTIONS,
  MAX_COLUMNS,
  MIN_COLUMNS,
  addCard,
  createInitialState,
  createBoard,
  deleteCard,
  exportStateToJson,
  findCardLocation,
  formatBoardDate,
  getBoardColumnCount,
  groupBoardUnderBoard,
  importStateFromJson,
  moveBoardToTopLevel,
  moveCard,
  renameBoard,
  renameColumn,
  resizeBoardColumns,
  updateCard,
  type Board,
  type TaskCard,
  type ThemeMode,
} from './lib/tintedFlow'

type BoardCardTarget = {
  boardId: string
  cardId: string
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type OfflineNotice = {
  kind: 'ready' | 'updated' | 'notes'
  version: string
}

const APP_RELEASE_VERSION = 'v1.0.0'
const OFFLINE_CACHE_VERSION_KEY = 'tinted-flow-offline-cache-version'
const OFFLINE_CHANGELOG: Record<string, string[]> = {
  [APP_RELEASE_VERSION]: [
    'Released the local-first single-user planning workspace as v1.0.0.',
    'Added installable PWA support with offline shell caching and update notices.',
    'Included JSON backup and restore, PDF export, grouping, and board resizing.',
  ],
}

function getInstallPromptDismissedKey(version: string) {
  const majorMatch = version.match(/^v?(\d+)/)
  const majorToken = majorMatch ? `v${majorMatch[1]}` : version

  return `tinted-flow-install-prompt-dismissed-${majorToken}`
}

function App() {
  const [initialPersistence] = useState(() => loadPersistedAppState())
  const [appState, setAppState] = useState(initialPersistence.state)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isPhonePortrait, setIsPhonePortrait] = useState(false)
  const [isSmallLandscape, setIsSmallLandscape] = useState(false)
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [offlineNotice, setOfflineNotice] = useState<OfflineNotice | null>(null)
  const [activeCardTarget, setActiveCardTarget] = useState<BoardCardTarget | null>(null)
  const [activeCardSize, setActiveCardSize] = useState<{ width: number; height: number } | null>(null)
  const [expandedCardTarget, setExpandedCardTarget] = useState<BoardCardTarget | null>(null)
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null)
  const [editingBoardName, setEditingBoardName] = useState('')
  const [pendingFocusTarget, setPendingFocusTarget] = useState<BoardCardTarget | null>(null)
  const [liveMessage, setLiveMessage] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isPomodoroOpen, setIsPomodoroOpen] = useState(false)
  const [isTodoOpen, setIsTodoOpen] = useState(false)
  const timer = usePomodoroTimer()
  const todo = useTodoList()
  const [storageMode, setStorageMode] = useState<StorageMode>(initialPersistence.storageMode)
  const boardExportRef = useRef<HTMLElement | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const skipNextPersistRef = useRef(false)
  const installPromptDismissedKey = getInstallPromptDismissedKey(APP_RELEASE_VERSION)

  const selectedBoard =
    appState.boards.find((board) => board.id === appState.selectedBoardId) ?? appState.boards[0]
  const selectedRootBoardId = getRootBoardId(appState.boards, selectedBoard?.id ?? null)
  const sidebarBoards = useMemo(
    () => appState.boards.filter((board) => board.parentBoardId === null),
    [appState.boards],
  )

  const visibleBoards = useMemo(
    () => getVisibleBoards(appState.boards, selectedRootBoardId),
    [appState.boards, selectedRootBoardId],
  )
  const isEmptyWorkspace = visibleBoards.length === 0
  const shouldHideSidebarForEmptyLandscape = isEmptyWorkspace && isSmallLandscape

  const activeCard = useMemo(() => {
    if (!activeCardTarget) {
      return null
    }

    const board = appState.boards.find((item) => item.id === activeCardTarget.boardId)
    return board?.cards[activeCardTarget.cardId] ?? null
  }, [activeCardTarget, appState.boards])

  const expandedBoard = useMemo(() => {
    if (!expandedCardTarget) {
      return null
    }

    return appState.boards.find((board) => board.id === expandedCardTarget.boardId) ?? null
  }, [appState.boards, expandedCardTarget])

  const expandedCard = useMemo(() => {
    if (!expandedBoard || !expandedCardTarget) {
      return null
    }

    return expandedBoard.cards[expandedCardTarget.cardId] ?? null
  }, [expandedBoard, expandedCardTarget])

  const expandedCardColumnName = useMemo(() => {
    if (!expandedBoard || !expandedCardTarget) {
      return null
    }

    const location = findCardLocation(expandedBoard, expandedCardTarget.cardId)
    return location ? expandedBoard.columns[location.columnId].name : null
  }, [expandedBoard, expandedCardTarget])

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 140,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )
  const boardSensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 140,
        tolerance: 8,
      },
    }),
  )

  useEffect(() => {
    if (storageMode === 'memory') {
      return
    }

    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false
      return
    }

    if (!persistAppState(appState)) {
      setStorageMode('memory')
      setLiveMessage('Local storage is unavailable. Changes will only last for this session.')
    }
  }, [appState, storageMode])

  useEffect(() => {
    if (storageMode === 'memory') {
      setLiveMessage('Local storage is unavailable. Changes will only last for this session.')
    }
  }, [storageMode])

  useEffect(() => {
    document.documentElement.style.colorScheme = appState.themeMode
  }, [appState.themeMode])

  useEffect(() => {
    if (!isSettingsOpen && !isPomodoroOpen && !isTodoOpen && !expandedCardTarget) {
      return
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (expandedCardTarget) {
          setExpandedCardTarget(null)
          return
        }

        if (isPomodoroOpen) {
          setIsPomodoroOpen(false)
          return
        }

        if (isTodoOpen) {
          setIsTodoOpen(false)
          return
        }

        setIsSettingsOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [expandedCardTarget, isSettingsOpen, isPomodoroOpen, isTodoOpen])

  useEffect(() => {
    if (!expandedCardTarget || expandedCard) {
      return
    }

    setExpandedCardTarget(null)
  }, [expandedCard, expandedCardTarget])

  useEffect(() => {
    function syncSidebarWithViewport() {
      const nextIsPhonePortrait = window.matchMedia('(max-width: 900px) and (orientation: portrait)').matches
      const nextIsSmallLandscape = window.matchMedia('(max-width: 1024px) and (orientation: landscape)').matches

      setIsPhonePortrait(nextIsPhonePortrait)
      setIsSmallLandscape(nextIsSmallLandscape)

      if (window.innerWidth <= 960 || nextIsPhonePortrait || (isEmptyWorkspace && nextIsSmallLandscape)) {
        setIsSidebarOpen(false)
        return
      }

      setIsSidebarOpen(true)
    }

    syncSidebarWithViewport()
    window.addEventListener('resize', syncSidebarWithViewport)
    return () => window.removeEventListener('resize', syncSidebarWithViewport)
  }, [isEmptyWorkspace])

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      const nextEvent = event as BeforeInstallPromptEvent

      nextEvent.preventDefault()
      setInstallPromptEvent(nextEvent)

      try {
        setShowInstallPrompt(window.localStorage.getItem(installPromptDismissedKey) !== 'true')
      } catch {
        setShowInstallPrompt(true)
      }
    }

    function handleAppInstalled() {
      try {
        window.localStorage.removeItem(installPromptDismissedKey)
      } catch {
        // Ignore storage failures and keep the installed-state UX working.
      }

      setInstallPromptEvent(null)
      setShowInstallPrompt(false)
      setLiveMessage('Tinted Flow installed.')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [installPromptDismissedKey])

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    function handleServiceWorkerMessage(event: MessageEvent) {
      const data = event.data as { type?: string; version?: string } | undefined

      if (data?.type !== 'SW_CACHE_STATUS' || typeof data.version !== 'string') {
        return
      }

      let previousVersion: string | null = null

      try {
        previousVersion = window.localStorage.getItem(OFFLINE_CACHE_VERSION_KEY)
        window.localStorage.setItem(OFFLINE_CACHE_VERSION_KEY, data.version)
      } catch {
        previousVersion = null
      }

      if (previousVersion === data.version) {
        return
      }

      const nextNotice = {
        kind: previousVersion ? 'updated' : 'ready',
        version: data.version,
      } as OfflineNotice

      setOfflineNotice(nextNotice)
      setLiveMessage(
        nextNotice.kind === 'updated'
          ? `Offline cache updated to ${data.version}.`
          : `Offline cache ready (${data.version}).`,
      )
    }

    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage)
    return () => navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage)
  }, [])

  function updateBoardById(boardId: string, updater: (board: Board) => Board) {
    setAppState((current) => ({
      ...current,
      boards: current.boards.map((board) => (board.id === boardId ? updater(board) : board)),
    }))
  }

  function handleCreateBoard() {
    const newBoard = createBoard(
      `Board ${appState.boards.length + 1}`,
      selectedBoard?.accent ?? ACCENT_OPTIONS[0].value,
      selectedBoard ? getBoardColumnCount(selectedBoard) : 4,
    )

    setAppState((current) => ({
      ...current,
      selectedBoardId: newBoard.id,
      boards: [...current.boards, newBoard],
    }))
    setEditingBoardId(null)
    setEditingBoardName('')
    setLiveMessage(`${newBoard.name} created.`)
  }

  function handleDeleteBoard(boardId: string) {
    const board = appState.boards.find((item) => item.id === boardId)

    if (!board) {
      return
    }

    const confirmed = window.confirm(`Delete ${board.name}? This removes all of its cards.`)

    if (!confirmed) {
      return
    }

    setAppState((current) => {
      const deletedBoard = current.boards.find((item) => item.id === boardId)

      if (!deletedBoard) {
        return current
      }

      const nextBoards = current.boards
        .filter((item) => item.id !== boardId)
        .map((item) =>
          item.parentBoardId === boardId
            ? {
                ...item,
                parentBoardId: deletedBoard.parentBoardId,
                updatedAt: new Date().toISOString(),
              }
            : item,
        )
      const nextSelectedBoardId =
        current.selectedBoardId === boardId ? (nextBoards[0]?.id ?? null) : current.selectedBoardId

      return {
        ...current,
        boards: nextBoards,
        selectedBoardId: nextSelectedBoardId,
      }
    })

    if (editingBoardId === boardId) {
      setEditingBoardId(null)
      setEditingBoardName('')
    }
    setLiveMessage(`${board.name} deleted.`)
  }

  function handleClearAll() {
    const shouldClear = window.confirm(
      'Clear every board and remove the saved local workspace data for this app? This cannot be undone.',
    )

    if (!shouldClear) {
      return
    }

    const didClearLocalCache =
      storageMode === 'local'
        ? clearPersistedAppState([installPromptDismissedKey, OFFLINE_CACHE_VERSION_KEY])
        : true

    if (storageMode === 'local') {
      skipNextPersistRef.current = didClearLocalCache
    }

    setAppState(createInitialState())
    setEditingBoardId(null)
    setEditingBoardName('')
    setExpandedCardTarget(null)
    setPendingFocusTarget(null)
    setActiveCardTarget(null)
    setActiveCardSize(null)
    setInstallPromptEvent(null)
    setShowInstallPrompt(false)
    setOfflineNotice(null)
    setIsSettingsOpen(false)

    if (storageMode === 'local' && !didClearLocalCache) {
      setStorageMode('memory')
      setLiveMessage('Workspace reset. Local storage is unavailable, so the fresh start is session-only.')
      return
    }

    setStorageMode(storageMode)
    setLiveMessage('Workspace reset to the welcome screen.')
  }

  function handleGroupBoards(sourceBoardId: string, targetBoardId: string) {
    if (sourceBoardId === targetBoardId) {
      return
    }

    const sourceBoard = appState.boards.find((board) => board.id === sourceBoardId)
    const targetBoard = appState.boards.find((board) => board.id === targetBoardId)

    if (!sourceBoard || !targetBoard) {
      return
    }

    const nextBoards = groupBoardUnderBoard(appState.boards, sourceBoardId, targetBoardId)

    if (nextBoards === appState.boards) {
      setLiveMessage('Boards cannot be placed underneath one of their own child boards.')
      return
    }

    const confirmed = window.confirm(
      `Group ${sourceBoard.name} with ${targetBoard.name}? They will appear under one sidebar entry while staying as separate boards in the main view.`,
    )

    if (!confirmed) {
      return
    }

    setAppState((current) => ({
      ...current,
      boards: groupBoardUnderBoard(current.boards, sourceBoardId, targetBoardId),
    }))
    setEditingBoardId(null)
    setEditingBoardName('')
    setExpandedCardTarget(null)
    setPendingFocusTarget(null)
    setLiveMessage(`${sourceBoard.name} placed under ${targetBoard.name}.`)
  }

  function handleMoveBoardToTopLevel(boardId: string) {
    const board = appState.boards.find((item) => item.id === boardId)

    if (!board || board.parentBoardId === null) {
      return
    }

    setAppState((current) => ({
      ...current,
      boards: moveBoardToTopLevel(current.boards, boardId),
    }))
    setLiveMessage(`${board.name} moved to the top level.`)
  }

  function handleSelectBoard(boardId: string) {
    setEditingBoardId(null)
    setEditingBoardName('')
    setAppState((current) => ({
      ...current,
      selectedBoardId: getRootBoardId(current.boards, boardId) ?? boardId,
    }))

    if (window.innerWidth <= 960) {
      setIsSidebarOpen(false)
    }
  }

  function startEditingBoard(board: Board) {
    setEditingBoardId(board.id)
    setEditingBoardName(board.name)
  }

  function commitBoardName(boardId: string) {
    if (editingBoardId !== boardId) {
      return
    }

    const board = appState.boards.find((item) => item.id === boardId)

    if (!board) {
      setEditingBoardId(null)
      setEditingBoardName('')
      return
    }

    const nextName = editingBoardName.trim()
    if (nextName && nextName !== board.name) {
      updateBoardById(boardId, (currentBoard) => renameBoard(currentBoard, nextName))
      setLiveMessage('Board renamed.')
    }

    setEditingBoardId(null)
    setEditingBoardName('')
  }

  function handleBoardNameKeyDown(boardId: string, event: ReactKeyboardEvent<HTMLInputElement>) {
    event.stopPropagation()

    if (event.key === 'Enter') {
      event.preventDefault()
      commitBoardName(boardId)
    }

    if (event.key === 'Escape') {
      setEditingBoardId(null)
      setEditingBoardName('')
    }
  }

  function handleAddCard(boardId: string, columnId: string) {
    let createdCardId: string | null = null

    setAppState((current) => ({
      ...current,
      boards: current.boards.map((board) => {
        if (board.id !== boardId) {
          return board
        }

        const result = addCard(board, columnId)

        if (!result) {
          return board
        }

        createdCardId = result.cardId
        return result.board
      }),
    }))

    if (createdCardId) {
      setPendingFocusTarget({ boardId, cardId: createdCardId })
      setLiveMessage('Card added. Start typing to edit.')
    }
  }

  function handleBoardColumnCountChange(boardId: string, nextValue: number) {
    const board = appState.boards.find((item) => item.id === boardId)

    if (!board) {
      return
    }

    const nextCount = Math.max(MIN_COLUMNS, Math.min(MAX_COLUMNS, nextValue))

    if (nextCount >= board.columnOrder.length) {
      updateBoardById(board.id, (currentBoard) => resizeBoardColumns(currentBoard, nextCount))
      setLiveMessage(`Board resized to ${nextCount} columns.`)
      return
    }

    const movedCardCount = board.columnOrder
      .slice(nextCount)
      .reduce((count, columnId) => count + board.columns[columnId].cardIds.length, 0)

    const shouldContinue =
      movedCardCount === 0 ||
      window.confirm(
        `${movedCardCount} card${movedCardCount === 1 ? '' : 's'} will move into the last remaining column. Continue?`,
      )

    if (!shouldContinue) {
      return
    }

    updateBoardById(board.id, (currentBoard) => resizeBoardColumns(currentBoard, nextCount))
    setLiveMessage(`Board resized to ${nextCount} columns.`)
  }

  function handleDragStart(boardId: string, event: DragStartEvent) {
    setActiveCardTarget({ boardId, cardId: String(event.active.id) })
    const initialRect = event.active.rect.current.initial

    if (initialRect) {
      setActiveCardSize({
        width: initialRect.width,
        height: initialRect.height,
      })
    }
  }

  function handleDragEnd(board: Board, event: DragEndEvent) {
    setActiveCardTarget(null)
    setActiveCardSize(null)

    if (!event.over) {
      return
    }

    const activeCardKey = String(event.active.id)
    const activeData = event.active.data.current
    const overData = event.over.data.current
    const fromColumnId = activeData?.columnId as string | undefined
    const toColumnId =
      overData?.type === 'card'
        ? (overData.columnId as string)
        : (overData?.columnId as string | undefined)

    if (!fromColumnId || !toColumnId) {
      return
    }

    const previousLocation = findCardLocation(board, activeCardKey)
    const overCardId = overData?.type === 'card' ? String(event.over.id) : undefined

    updateBoardById(board.id, (currentBoard) => moveCard(currentBoard, activeCardKey, fromColumnId, toColumnId, overCardId))

    const sourceColumn = previousLocation ? board.columns[previousLocation.columnId] : board.columns[fromColumnId]
    const destinationColumn = board.columns[toColumnId]
    setLiveMessage(
      `${board.cards[activeCardKey]?.title ?? 'Card'} moved from ${sourceColumn.name} to ${destinationColumn.name}.`,
    )
  }

  function handleBoardDragEnd(event: DragEndEvent) {
    const targetBoardId = event.over?.data.current?.boardId as string | undefined

    if (!targetBoardId) {
      return
    }

    handleGroupBoards(String(event.active.id), targetBoardId)
  }

  function handleUpdateCard(
    boardId: string,
    cardId: string,
    updates: Partial<Pick<TaskCard, 'title' | 'content' | 'color'>>,
  ) {
    updateBoardById(boardId, (board) => updateCard(board, cardId, updates))
    setLiveMessage('Card updated.')
  }

  function handleOpenCard(boardId: string, cardId: string) {
    setExpandedCardTarget({ boardId, cardId })
  }

  async function handleExportPdf() {
    if (!selectedBoard || !boardExportRef.current) {
      return
    }

    try {
      setIsExporting(true)
      await new Promise((resolve) => window.setTimeout(resolve, 60))
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])

      const canvas = await html2canvas(boardExportRef.current, {
        backgroundColor: null,
        scale: Math.min(window.devicePixelRatio || 2, 2),
        useCORS: true,
        scrollX: 0,
        scrollY: -window.scrollY,
      })

      const imageData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height],
      })

      pdf.addImage(imageData, 'PNG', 0, 0, canvas.width, canvas.height)
      pdf.save(`${slugify(selectedBoard.name)}.pdf`)
      setLiveMessage(`${selectedBoard.name} downloaded as PDF.`)
    } catch {
      setLiveMessage('PDF export failed. Try again after collapsing very large boards.')
    } finally {
      setIsExporting(false)
    }
  }

  function handleExportData() {
    const json = exportStateToJson(appState)
    const blob = new Blob([json], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    const timestamp = new Date().toISOString().slice(0, 10)

    link.href = url
    link.download = `tinted-flow-backup-${timestamp}.json`
    link.click()
    window.URL.revokeObjectURL(url)
    setLiveMessage('JSON backup downloaded.')
  }

  function handleOpenImportDialog() {
    importInputRef.current?.click()
  }

  async function handleImportData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    const shouldReplace = window.confirm('Importing a backup will replace the current boards in this browser. Continue?')

    if (!shouldReplace) {
      event.target.value = ''
      return
    }

    try {
      const importedState = importStateFromJson(await file.text())

      if (!importedState) {
        throw new Error('invalid-backup')
      }

      setAppState(importedState)
      setEditingBoardId(null)
      setEditingBoardName('')
      setExpandedCardTarget(null)
      setPendingFocusTarget(null)
      setIsSettingsOpen(false)
      setLiveMessage(`${importedState.boards.length} board${importedState.boards.length === 1 ? '' : 's'} imported.`)
    } catch {
      window.alert('Import failed. Choose a valid Tinted Flow JSON backup.')
      setLiveMessage('Import failed. Choose a valid Tinted Flow JSON backup.')
    } finally {
      event.target.value = ''
    }
  }

  function setThemeMode(themeMode: ThemeMode) {
    setAppState((current) => ({
      ...current,
      themeMode,
    }))
  }

  function handlePendingFocusHandled(boardId: string, cardId: string) {
    setPendingFocusTarget((current) =>
      current?.boardId === boardId && current.cardId === cardId ? null : current,
    )
  }

  function toggleSidebar() {
    setIsSidebarOpen((current) => !current)
  }

  function dismissInstallPrompt() {
    try {
      window.localStorage.setItem(installPromptDismissedKey, 'true')
    } catch {
      // Ignore storage failures and just dismiss for the current session.
    }

    setShowInstallPrompt(false)
  }

  async function handleInstallApp() {
    if (!installPromptEvent) {
      return
    }

    await installPromptEvent.prompt()
    const choice = await installPromptEvent.userChoice

    try {
      if (choice.outcome === 'accepted') {
        window.localStorage.removeItem(installPromptDismissedKey)
      } else {
        window.localStorage.setItem(installPromptDismissedKey, 'true')
      }
    } catch {
      // Ignore storage failures and continue with the prompt outcome.
    }

    setInstallPromptEvent(null)
    setShowInstallPrompt(false)
    setLiveMessage(
      choice.outcome === 'accepted' ? 'Install started.' : 'Install prompt dismissed.',
    )
  }

  function handleViewLatestChangelog() {
    setOfflineNotice({ kind: 'notes', version: APP_RELEASE_VERSION })
    setIsSettingsOpen(false)
    setLiveMessage(`Showing latest changelog for ${APP_RELEASE_VERSION}.`)
  }

  return (
    <div
      className="app-shell"
      data-empty-workspace={isEmptyWorkspace}
      data-phone-portrait={isPhonePortrait}
      data-sidebar-open={isSidebarOpen}
      data-theme={appState.themeMode}
    >
      <input
        accept="application/json,.json"
        className="sr-only"
        onChange={handleImportData}
        ref={importInputRef}
        type="file"
      />

      <div aria-live="polite" className="sr-only">
        {liveMessage}
      </div>

      {showInstallPrompt || offlineNotice ? (
        <section aria-label="Application notices" className="app-notice-stack">
          {showInstallPrompt && installPromptEvent ? (
            <section className="app-notice-card" role="status">
              <div className="app-notice-copy">
                <p className="eyebrow">Install App</p>
                <h2>Add Tinted Flow to your device</h2>
                <p className="panel-note">
                  Install Tinted Flow for quicker launch and a more app-like offline experience on supported browsers.
                </p>
              </div>
              <div className="app-notice-actions">
                <button className="primary-action" onClick={handleInstallApp} type="button">
                  Install
                </button>
                <button className="ghost-action" onClick={dismissInstallPrompt} type="button">
                  Not now
                </button>
              </div>
            </section>
          ) : null}

          {offlineNotice ? (
            <section className="app-notice-card offline" role="status">
              <div className="app-notice-copy">
                <p className="eyebrow">Offline Cache</p>
                <h2>
                  {offlineNotice.kind === 'updated'
                    ? `Offline cache updated to ${offlineNotice.version}`
                    : offlineNotice.kind === 'notes'
                      ? `What's new in ${offlineNotice.version}`
                      : `Offline cache ready (${offlineNotice.version})`}
                </h2>
                <p className="panel-note">
                  {offlineNotice.kind === 'notes'
                    ? 'Latest release notes for the current app version.'
                    : 'The app shell is cached for offline reuse. Reload once after major updates if the UI ever feels out of date.'}
                </p>
                {OFFLINE_CHANGELOG[offlineNotice.version] ? (
                  <div className="app-notice-meta" aria-label={`What's new in ${offlineNotice.version}`}>
                    <p className="eyebrow">What's new in {offlineNotice.version}</p>
                    <ul className="app-notice-changelog">
                      {OFFLINE_CHANGELOG[offlineNotice.version].map((entry) => (
                        <li key={entry}>{entry}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
              <div className="app-notice-actions">
                <button className="ghost-action" onClick={() => setOfflineNotice(null)} type="button">
                  Dismiss
                </button>
              </div>
            </section>
          ) : null}
        </section>
      ) : null}

      {isPhonePortrait ? (
        <section aria-label="Rotate device hint" className="orientation-hint" role="status">
          <div className="orientation-hint-card">
            <p className="eyebrow">Phone view</p>
            <h2>Rotate to landscape</h2>
            <p className="panel-note">
              Tinted Flow is tuned for landscape on phones so the board and welcome state have enough room.
            </p>
          </div>
        </section>
      ) : null}

      <header className="app-topbar">
        <div className="topbar-leading">
          {shouldHideSidebarForEmptyLandscape ? null : (
            <button
              aria-controls="planner-sidebar"
              aria-expanded={isSidebarOpen}
              aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              className="sidebar-toggle-button"
              onClick={toggleSidebar}
              type="button"
            >
              <span aria-hidden="true" className="sidebar-toggle-lines">
                <span />
                <span />
                <span />
              </span>
            </button>
          )}

          <div className="app-branding">
            <p className="app-wordmark">
              Tinted <span>Flow</span>
            </p>
            <p className="app-caption">Accessible kanban workspace</p>
          </div>
        </div>

        <div className="topbar-actions" aria-label="Application controls">
          {storageMode === 'memory' ? <p className="panel-note topbar-status">Session-only mode</p> : null}
          {timer.hasStarted ? (
            <div className="pomo-topbar-widget" data-running={timer.isRunning} data-phase={timer.phase} aria-label="Pomodoro timer">
              <span className="pomo-topbar-phase">{phaseLabel(timer.phase)}</span>
              <span className="pomo-topbar-time">{formatTime(timer.timeLeft)}</span>
              <div className="pomo-topbar-controls">
                {timer.isRunning ? (
                  <button className="pomo-topbar-btn" onClick={timer.pause} type="button" aria-label="Pause timer">⏸</button>
                ) : (
                  <button className="pomo-topbar-btn" onClick={timer.start} type="button" aria-label="Resume timer">▶</button>
                )}
                <button className="pomo-topbar-btn" onClick={timer.reset} type="button" aria-label="Stop timer">⏹</button>
              </div>
            </div>
          ) : null}
          <div className="topbar-primary-actions">
            <button className="ghost-action" onClick={() => setIsTodoOpen(true)} type="button">
              Tasks
            </button>
            <button className="ghost-action" onClick={() => setIsPomodoroOpen(true)} type="button">
              Pomodoro
            </button>
            <button className="ghost-action" onClick={() => setIsSettingsOpen(true)} type="button">
              Settings
            </button>
          </div>
        </div>
      </header>

      {isSidebarOpen && !shouldHideSidebarForEmptyLandscape ? (
        <button aria-label="Close sidebar" className="sidebar-backdrop" onClick={toggleSidebar} type="button" />
      ) : null}

      <main className="planner-layout">
        {shouldHideSidebarForEmptyLandscape ? null : (
          <aside className="planner-sidebar" id="planner-sidebar">
            <div className="planner-sidebar-header">
              <p className="eyebrow">Boards</p>
              <button className="sidebar-primary-action" onClick={handleCreateBoard} type="button">
                New board
              </button>
            </div>

            <DndContext collisionDetection={closestCenter} onDragEnd={handleBoardDragEnd} sensors={boardSensors}>
              <div className="planner-sidebar-list" role="list" aria-label="Saved boards">
                {sidebarBoards.map((board) => (
                  <SidebarBoardItem
                    board={board}
                    canDelete={true}
                    depth={0}
                    isSelected={board.id === selectedRootBoardId}
                    key={board.id}
                    onDelete={handleDeleteBoard}
                    onSelect={handleSelectBoard}
                  />
                ))}
              </div>
            </DndContext>
          </aside>
        )}

        <section className="planner-content">
          {isEmptyWorkspace ? (
            <section className="board-surface empty-workspace" ref={boardExportRef}>
              <p className="eyebrow">Workspace</p>
              <h2>No boards yet</h2>
              <p className="panel-note empty-workspace-copy">
                Boards stay only in this browser unless you export a backup, and you can group boards later by dragging one board onto another in the sidebar.
              </p>
              <div className="empty-workspace-actions">
                <button className="ghost-action" onClick={handleCreateBoard} type="button">
                  Create first board
                </button>
                <button className="ghost-action" onClick={() => setIsSettingsOpen(true)} type="button">
                  Open settings
                </button>
              </div>
            </section>
          ) : (
            <section className="board-group-stack" data-exporting={isExporting} ref={boardExportRef}>
              {visibleBoards.map((board, index) => (
                <section className="board-surface board-group-member" key={board.id}>
                  <div className="board-surface-header compact">
                    <div>
                      <p className="eyebrow">{index === 0 ? 'Current board' : 'Grouped board'}</p>
                      {editingBoardId === board.id ? (
                        <input
                          aria-label="Board name"
                          autoFocus
                          className="board-title-input"
                          onBlur={() => commitBoardName(board.id)}
                          onChange={(event) => setEditingBoardName(event.target.value)}
                          onKeyDown={(event) => handleBoardNameKeyDown(board.id, event)}
                          onPointerDown={(event) => event.stopPropagation()}
                          type="text"
                          value={editingBoardName}
                        />
                      ) : (
                        <button className="board-title-button" onClick={() => startEditingBoard(board)} type="button">
                          <h2>{board.name}</h2>
                        </button>
                      )}
                    </div>
                    <div className="board-surface-meta">
                      <div className="board-column-controls" aria-label={`${board.name} column controls`} role="group">
                        <span className="board-column-controls-label">Columns</span>
                        <button
                          aria-label={`Decrease columns for ${board.name}`}
                          className="ghost-action board-column-action"
                          disabled={board.columnOrder.length <= MIN_COLUMNS}
                          onClick={() => handleBoardColumnCountChange(board.id, board.columnOrder.length - 1)}
                          type="button"
                        >
                          -
                        </button>
                        <strong className="board-column-count">{board.columnOrder.length}</strong>
                        <button
                          aria-label={`Increase columns for ${board.name}`}
                          className="ghost-action board-column-action"
                          disabled={board.columnOrder.length >= MAX_COLUMNS}
                          onClick={() => handleBoardColumnCountChange(board.id, board.columnOrder.length + 1)}
                          type="button"
                        >
                          +
                        </button>
                      </div>
                      {board.parentBoardId ? (
                        <button
                          className="ghost-action"
                          onClick={() => handleMoveBoardToTopLevel(board.id)}
                          type="button"
                        >
                          Unmerge
                        </button>
                      ) : null}
                      <p className="panel-note">Updated {formatBoardDate(board.updatedAt)}</p>
                    </div>
                  </div>

                  <DndContext
                    accessibility={{
                      announcements: {
                        onDragStart: ({ active }) => `${board.cards[String(active.id)]?.title ?? 'Card'} picked up.`,
                        onDragOver: ({ active, over }) => {
                          if (!over) {
                            return 'Card is moving.'
                          }

                          return `${board.cards[String(active.id)]?.title ?? 'Card'} is over a new drop target.`
                        },
                        onDragEnd: ({ active, over }) => {
                          if (!over) {
                            return 'Card dropped.'
                          }

                          return `${board.cards[String(active.id)]?.title ?? 'Card'} dropped.`
                        },
                        onDragCancel: () => 'Movement cancelled.',
                      },
                    }}
                    collisionDetection={closestCorners}
                    onDragEnd={(event) => handleDragEnd(board, event)}
                    onDragStart={(event) => handleDragStart(board.id, event)}
                    sensors={sensors}
                  >
                    <div
                      className="board-grid"
                      style={{
                        gridTemplateColumns: `repeat(${board.columnOrder.length}, minmax(var(--board-column-min, 16rem), 1fr))`,
                      }}
                    >
                      {board.columnOrder.map((columnId) => {
                        const column = board.columns[columnId]
                        const cards = column.cardIds.map((cardId) => board.cards[cardId])

                        return (
                          <BoardColumnView
                            cards={cards}
                            column={column}
                            key={column.id}
                            onAddCard={(nextColumnId) => handleAddCard(board.id, nextColumnId)}
                            onDeleteCard={(cardId) => {
                              updateBoardById(board.id, (currentBoard) => deleteCard(currentBoard, cardId))
                              setLiveMessage('Card deleted.')
                            }}
                            onOpenCard={(cardId) => handleOpenCard(board.id, cardId)}
                            onPendingFocusHandled={(cardId) => handlePendingFocusHandled(board.id, cardId)}
                            onRenameColumn={(value) =>
                              updateBoardById(board.id, (currentBoard) => renameColumn(currentBoard, column.id, value))
                            }
                            onUpdateCard={(cardId, updates) => handleUpdateCard(board.id, cardId, updates)}
                            pendingFocusCardId={
                              pendingFocusTarget?.boardId === board.id ? pendingFocusTarget.cardId : null
                            }
                          />
                        )
                      })}
                    </div>

                    <DragOverlay>{activeCard ? <CardPreview card={activeCard} size={activeCardSize} /> : null}</DragOverlay>
                  </DndContext>
                </section>
              ))}
            </section>
          )}
        </section>
      </main>

      <PomodoroModal isOpen={isPomodoroOpen} onClose={() => setIsPomodoroOpen(false)} timer={timer} />

      <TodoModal isOpen={isTodoOpen} onClose={() => setIsTodoOpen(false)} todo={todo} />

      <SettingsModal
        appState={appState}
        isOpen={isSettingsOpen}
        isExporting={isExporting}
        onClose={() => setIsSettingsOpen(false)}
        onClearAll={handleClearAll}
        onCreateBoard={handleCreateBoard}
        onDeleteBoard={handleDeleteBoard}
        onDownloadPdf={handleExportPdf}
        onExportData={handleExportData}
        onImportData={handleOpenImportDialog}
        onSelectBoard={handleSelectBoard}
        onSetThemeMode={setThemeMode}
        onViewLatestChangelog={handleViewLatestChangelog}
        selectedBoard={selectedBoard ?? null}
        storageMode={storageMode}
        themeMode={appState.themeMode}
        latestReleaseVersion={APP_RELEASE_VERSION}
      />

      <CardDetailModal
        card={expandedCard}
        columnName={expandedCardColumnName}
        isOpen={Boolean(expandedCard)}
        onClose={() => setExpandedCardTarget(null)}
        onDeleteCard={(cardId) => {
          if (!expandedBoard) {
            return
          }

          updateBoardById(expandedBoard.id, (board) => deleteCard(board, cardId))
          setExpandedCardTarget(null)
          setLiveMessage('Card deleted.')
        }}
        onUpdateCard={(cardId, updates) => {
          if (!expandedBoard) {
            return
          }

          handleUpdateCard(expandedBoard.id, cardId, updates)
        }}
      />

      <footer className="app-footer">
        <p className="app-footer-copy">© 2026 Tinted Technologies LLC. All rights reserved.</p>
      </footer>
    </div>
  )
}

function getVisibleBoards(boards: Board[], selectedBoardId: string | null): Board[] {
  if (!selectedBoardId) {
    return []
  }

  const visibleBoards: Board[] = []
  const boardMap = new Map(boards.map((board) => [board.id, board]))

  function appendBoard(boardId: string) {
    const board = boardMap.get(boardId)

    if (!board) {
      return
    }

    visibleBoards.push(board)

    for (const childBoard of boards) {
      if (childBoard.parentBoardId === boardId) {
        appendBoard(childBoard.id)
      }
    }
  }

  appendBoard(selectedBoardId)
  return visibleBoards
}

function getRootBoardId(boards: Board[], boardId: string | null): string | null {
  if (!boardId) {
    return null
  }

  const boardMap = new Map(boards.map((board) => [board.id, board]))
  let currentBoard = boardMap.get(boardId) ?? null

  while (currentBoard?.parentBoardId) {
    currentBoard = boardMap.get(currentBoard.parentBoardId) ?? null
  }

  return currentBoard?.id ?? null
}

function slugify(value: string): string {
  return (
    value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') ||
    'tinted-flow-board'
  )
}

export default App
