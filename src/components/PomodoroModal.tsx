import { useDialogFocusTrap } from './useDialogFocusTrap'
import { formatTime, phaseLabel, type PomodoroTimerHandle } from './usePomodoroTimer'

type PomodoroModalProps = {
  isOpen: boolean
  onClose: () => void
  timer: PomodoroTimerHandle
}

function PomodoroModal({ isOpen, onClose, timer }: PomodoroModalProps) {
  const dialogRef = useDialogFocusTrap({ isOpen })
  const {
    config,
    setConfig,
    phase,
    timeLeft,
    isRunning,
    completedPomodoros,
    start,
    pause,
    reset,
    skipPhase,
  } = timer

  if (!isOpen) {
    return null
  }

  return (
    <div className="pomo-backdrop" onClick={onClose}>
      <section
        aria-labelledby="pomo-title"
        aria-modal="true"
        className="pomo-dialog"
        data-running={isRunning}
        data-phase={phase}
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="pomo-header">
          <div>
            <p className="eyebrow">Focus</p>
            <h2 id="pomo-title">Pomodoro Timer</h2>
          </div>
          <button
            aria-label="Close pomodoro timer"
            className="ghost-action"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <div className="pomo-body">
          {/* Left: timer display + controls */}
          <div className="pomo-left">
            <div className="pomo-display">
              <span className="pomo-phase-badge" data-phase={phase}>
                {phaseLabel(phase)}
              </span>
              <p aria-live="off" className="pomo-countdown" aria-label={`Time remaining: ${formatTime(timeLeft)}`}>
                {formatTime(timeLeft)}
              </p>
              <p className="pomo-cycles panel-note">
                {completedPomodoros === 0
                  ? 'No pomodoros completed yet'
                  : `${completedPomodoros} pomodoro${completedPomodoros === 1 ? '' : 's'} completed`}
              </p>
            </div>

            <div className="pomo-controls" role="group" aria-label="Timer controls">
              {isRunning ? (
                <button className="primary-action" onClick={pause} type="button">
                  Pause
                </button>
              ) : (
                <button className="primary-action" onClick={start} type="button">
                  {timeLeft === 0 ? 'Restart' : 'Start'}
                </button>
              )}
              <button className="ghost-action" onClick={reset} type="button">
                Reset
              </button>
              <button className="ghost-action" onClick={skipPhase} type="button">
                Skip
              </button>
            </div>
          </div>

          {/* Right: config */}
          <section className="pomo-config" aria-label="Timer configuration">
            <p className="eyebrow">Configuration</p>
            <div className="pomo-config-grid">
              <label className="pomo-config-item">
                <span className="pomo-config-label">Work (min)</span>
                <input
                  className="pomo-config-input"
                  min={1}
                  max={120}
                  type="number"
                  value={config.workMin}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10)
                    if (v > 0) setConfig({ ...config, workMin: v })
                  }}
                />
              </label>

              <label className="pomo-config-item">
                <span className="pomo-config-label">Short break (min)</span>
                <input
                  className="pomo-config-input"
                  min={1}
                  max={60}
                  type="number"
                  value={config.shortBreakMin}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10)
                    if (v > 0) setConfig({ ...config, shortBreakMin: v })
                  }}
                />
              </label>

              <label className="pomo-config-item">
                <span className="pomo-config-label">Long break (min)</span>
                <input
                  className="pomo-config-input"
                  min={1}
                  max={120}
                  type="number"
                  value={config.longBreakMin}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10)
                    if (v > 0) setConfig({ ...config, longBreakMin: v })
                  }}
                />
              </label>

              <label className="pomo-config-item">
                <span className="pomo-config-label">Cycles before long break</span>
                <input
                  className="pomo-config-input"
                  min={1}
                  max={10}
                  type="number"
                  value={config.cyclesBeforeLong}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10)
                    if (v > 0) setConfig({ ...config, cyclesBeforeLong: v })
                  }}
                />
              </label>
            </div>

            <label className="pomo-sound-toggle">
              <input
                checked={config.soundEnabled}
                onChange={(e) => setConfig({ ...config, soundEnabled: e.target.checked })}
                type="checkbox"
              />
              <span>Sound on phase end</span>
            </label>
          </section>
        </div>
      </section>
    </div>
  )
}

export default PomodoroModal
