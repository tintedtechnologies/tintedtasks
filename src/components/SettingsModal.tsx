import { getBoardCardCount, type Board, type PersistedState, type ThemeMode } from '../lib/tintedTasks'
import { type StorageMode } from '../lib/persistence'
import { useDialogFocusTrap } from './useDialogFocusTrap'

type SettingsModalProps = {
  appState: PersistedState
  selectedBoard: Board | null
  isOpen: boolean
  isExporting: boolean
  latestReleaseVersion: string
  storageMode: StorageMode
  themeMode: ThemeMode
  onClose: () => void
  onCreateBoard: () => void
  onSelectBoard: (boardId: string) => void
  onDeleteBoard: (boardId: string) => void
  onSetThemeMode: (themeMode: ThemeMode) => void
  onDownloadPdf: () => void
  onExportData: () => void
  onImportData: () => void
  onViewLatestChangelog: () => void
  onClearAll: () => void
}

function SettingsModal({
  appState,
  selectedBoard,
  isOpen,
  isExporting,
  latestReleaseVersion,
  storageMode,
  themeMode,
  onClose,
  onCreateBoard,
  onSelectBoard,
  onDeleteBoard,
  onSetThemeMode,
  onDownloadPdf,
  onExportData,
  onImportData,
  onViewLatestChangelog,
  onClearAll,
}: SettingsModalProps) {
  const dialogRef = useDialogFocusTrap({ isOpen })
  const totalCards = appState.boards.reduce((count, board) => count + getBoardCardCount(board), 0)

  if (!isOpen) {
    return null
  }

  return (
    <div className="settings-backdrop" onClick={onClose}>
      <section
        aria-labelledby="settings-title"
        aria-modal="true"
        className="settings-modal"
        onClick={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="settings-header">
          <div className="settings-header-copy">
            <p className="eyebrow">Settings</p>
            <h2 id="settings-title">Workspace configuration</h2>
            <p className="panel-note settings-header-note">
              Boards, appearance, and backups in one place.
            </p>
          </div>
          <button aria-label="Close settings" className="ghost-action" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="settings-overview" aria-label="Workspace summary">
          <article className="settings-overview-card">
            <span className="settings-overview-label">Boards</span>
            <strong>{appState.boards.length}</strong>
            <small>{selectedBoard ? `Active: ${selectedBoard.name}` : 'No board selected'}</small>
          </article>
          <article className="settings-overview-card">
            <span className="settings-overview-label">Cards</span>
            <strong>{totalCards}</strong>
            <small>In this workspace</small>
          </article>
          <article className="settings-overview-card">
            <span className="settings-overview-label">Storage</span>
            <strong>{storageMode === 'memory' ? 'Session' : 'Local'}</strong>
            <small>{latestReleaseVersion}</small>
          </article>
        </div>

        <div className="settings-grid">
          <section className="settings-section settings-section-boards">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Boards</p>
                <h3>Saved workspaces</h3>
                <p className="panel-note settings-section-note">
                  Switch or remove saved boards.
                </p>
              </div>
              <button className="ghost-action" onClick={onCreateBoard} type="button">
                New board
              </button>
            </div>

            <div className="board-list" role="list" aria-label="Saved boards">
              {appState.boards.length === 0 ? (
                <p className="panel-note">No boards saved yet.</p>
              ) : (
                appState.boards.map((board) => (
                  <article
                    className={board.id === selectedBoard?.id ? 'board-chip selected' : 'board-chip'}
                    key={board.id}
                    role="listitem"
                  >
                    <button className="board-chip-main" onClick={() => onSelectBoard(board.id)} type="button">
                      <span
                        aria-hidden="true"
                        className="board-chip-swatch"
                        style={{ backgroundColor: board.accent }}
                      />
                      <span>
                        <strong>{board.name}</strong>
                        <small>{getBoardCardCount(board)} cards</small>
                      </span>
                    </button>
                    <button
                      aria-label={`Delete ${board.name}`}
                      className="board-chip-delete"
                      onClick={() => onDeleteBoard(board.id)}
                      type="button"
                    >
                      Remove
                    </button>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="settings-section">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Appearance</p>
                <h3>Workspace appearance</h3>
                <p className="panel-note settings-section-note">
                  Pick the mode that reads best right now.
                </p>
              </div>
            </div>

            <div className="field-group settings-theme-group">
              <span>Theme mode</span>
              <div className="theme-toggle" role="group" aria-label="Theme mode">
                <button
                  className={themeMode === 'light' ? 'active' : ''}
                  onClick={() => onSetThemeMode('light')}
                  type="button"
                >
                  Light
                </button>
                <button
                  className={themeMode === 'dark' ? 'active' : ''}
                  onClick={() => onSetThemeMode('dark')}
                  type="button"
                >
                  Dark
                </button>
              </div>
            </div>

            <div className="settings-note-card">
              <p className="panel-note">
                Light mode is softer, dark mode keeps the same accent, and board column sizing stays in the workspace itself.
              </p>
            </div>
          </section>

          <section className="settings-section settings-section-wide">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Data</p>
                <h3>Backup and recovery</h3>
                <p className="panel-note settings-section-note">
                  Export, restore, and review release notes.
                </p>
              </div>
            </div>

            <div className="settings-tool-list">
              <article className="settings-tool-row">
                <div>
                  <h4>Board PDF</h4>
                  <p className="panel-note">Snapshot the selected board.</p>
                </div>
                <button className="ghost-action settings-compact-action" disabled={!selectedBoard || isExporting} onClick={onDownloadPdf} type="button">
                  {!selectedBoard ? 'Board required' : isExporting ? 'Preparing PDF...' : 'Download PDF'}
                </button>
              </article>

              <article className="settings-tool-row">
                <div>
                  <h4>JSON export</h4>
                  <p className="panel-note">Save the workspace to a backup file.</p>
                </div>
                <button className="ghost-action settings-compact-action" onClick={onExportData} type="button">
                  Export backup
                </button>
              </article>

              <article className="settings-tool-row">
                <div>
                  <h4>JSON import</h4>
                  <p className="panel-note">Restore a previously exported backup.</p>
                </div>
                <button className="ghost-action settings-compact-action" onClick={onImportData} type="button">
                  Import backup
                </button>
              </article>

              <article className="settings-tool-row">
                <div>
                  <h4>Release notes</h4>
                  <p className="panel-note">See what changed in the latest version.</p>
                </div>
                <button className="ghost-action settings-compact-action" onClick={onViewLatestChangelog} type="button">
                  View changelog
                </button>
              </article>

              <article className="settings-tool-row danger">
                <div>
                  <h4>Reset workspace</h4>
                  <p className="panel-note">Remove every board, clear local data, and return to the first-run welcome screen.</p>
                </div>
                <button className="ghost-action settings-danger settings-compact-action" onClick={onClearAll} type="button">
                  Reset to welcome
                </button>
              </article>
            </div>

            <div className="settings-note-stack">
              <p className="panel-note">
                Data stays on this browser unless you export a JSON backup. PDF export is a snapshot of the selected board, not a recovery format.
              </p>
              <p className="panel-note">Latest release notes: {latestReleaseVersion}.</p>
              <p className="panel-note">
                Drag a board card onto another in the sidebar to group them under one sidebar entry. You will be asked to confirm first, and grouped child boards can be unmerged from the main view.
              </p>
            </div>
            {storageMode === 'memory' ? (
              <p className="panel-note settings-warning">
                Local storage is unavailable. Imports and edits will only last for this session until storage works again.
              </p>
            ) : null}
          </section>
        </div>
      </section>
    </div>
  )
}

export default SettingsModal