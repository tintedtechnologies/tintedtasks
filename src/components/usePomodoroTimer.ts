import { useCallback, useEffect, useRef, useState } from 'react'

export type PomodoroPhase = 'work' | 'shortBreak' | 'longBreak'

export type PomodoroConfig = {
  workMin: number
  shortBreakMin: number
  longBreakMin: number
  cyclesBeforeLong: number
  soundEnabled: boolean
}

const DEFAULT_CONFIG: PomodoroConfig = {
  workMin: 25,
  shortBreakMin: 5,
  longBreakMin: 15,
  cyclesBeforeLong: 4,
  soundEnabled: true,
}

const CONFIG_STORAGE_KEY = 'pomo-config'

function loadConfig(): PomodoroConfig {
  try {
    const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY)
    if (!raw) return DEFAULT_CONFIG
    const parsed = JSON.parse(raw) as Partial<PomodoroConfig>
    return {
      workMin: typeof parsed.workMin === 'number' && parsed.workMin > 0 ? parsed.workMin : DEFAULT_CONFIG.workMin,
      shortBreakMin: typeof parsed.shortBreakMin === 'number' && parsed.shortBreakMin > 0 ? parsed.shortBreakMin : DEFAULT_CONFIG.shortBreakMin,
      longBreakMin: typeof parsed.longBreakMin === 'number' && parsed.longBreakMin > 0 ? parsed.longBreakMin : DEFAULT_CONFIG.longBreakMin,
      cyclesBeforeLong: typeof parsed.cyclesBeforeLong === 'number' && parsed.cyclesBeforeLong > 0 ? parsed.cyclesBeforeLong : DEFAULT_CONFIG.cyclesBeforeLong,
      soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : DEFAULT_CONFIG.soundEnabled,
    }
  } catch {
    return DEFAULT_CONFIG
  }
}

function playChime(config: PomodoroConfig) {
  if (!config.soundEnabled) return

  try {
    const ctx = new AudioContext()
    const frequencies = [880, 1108, 1320]

    frequencies.forEach((freq, i) => {
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()

      oscillator.connect(gain)
      gain.connect(ctx.destination)

      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.18)

      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.18)
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.7)

      oscillator.start(ctx.currentTime + i * 0.18)
      oscillator.stop(ctx.currentTime + i * 0.18 + 0.75)
    })

    // Close context after the last note finishes
    setTimeout(() => ctx.close(), 1800)
  } catch {
    // AudioContext not available — silently skip
  }
}

function phaseMinutes(phase: PomodoroPhase, config: PomodoroConfig): number {
  if (phase === 'work') return config.workMin
  if (phase === 'shortBreak') return config.shortBreakMin
  return config.longBreakMin
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function phaseLabel(phase: PomodoroPhase): string {
  if (phase === 'work') return 'Work'
  if (phase === 'shortBreak') return 'Short Break'
  return 'Long Break'
}

export type PomodoroTimerHandle = {
  config: PomodoroConfig
  setConfig: (next: PomodoroConfig) => void
  phase: PomodoroPhase
  timeLeft: number
  isRunning: boolean
  hasStarted: boolean
  completedPomodoros: number
  start: () => void
  pause: () => void
  reset: () => void
  skipPhase: () => void
}

export function usePomodoroTimer(): PomodoroTimerHandle {
  const [config, setConfigState] = useState<PomodoroConfig>(loadConfig)
  const [phase, setPhase] = useState<PomodoroPhase>('work')
  const [timeLeft, setTimeLeft] = useState(() => loadConfig().workMin * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [completedPomodoros, setCompletedPomodoros] = useState(0)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const configRef = useRef(config)
  const phaseRef = useRef(phase)
  const completedRef = useRef(completedPomodoros)

  // Keep refs in sync so interval closure always reads latest values
  useEffect(() => { configRef.current = config }, [config])
  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { completedRef.current = completedPomodoros }, [completedPomodoros])

  // Persist config changes
  useEffect(() => {
    try {
      window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config))
    } catch {
      // Ignore storage failures
    }
  }, [config])

  const stopInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const advancePhase = useCallback((currentPhase: PomodoroPhase, currentCompleted: number) => {
    let nextPhase: PomodoroPhase
    let nextCompleted = currentCompleted

    if (currentPhase === 'work') {
      nextCompleted = currentCompleted + 1
      nextPhase = nextCompleted % configRef.current.cyclesBeforeLong === 0 ? 'longBreak' : 'shortBreak'
    } else {
      nextPhase = 'work'
    }

    setCompletedPomodoros(nextCompleted)
    setPhase(nextPhase)
    setTimeLeft(phaseMinutes(nextPhase, configRef.current) * 60)
    setIsRunning(false)
    setHasStarted(false)
    playChime(configRef.current)
  }, [])

  const start = useCallback(() => {
    setIsRunning(true)
    setHasStarted(true)
    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          stopInterval()
          advancePhase(phaseRef.current, completedRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [advancePhase, stopInterval])

  const pause = useCallback(() => {
    stopInterval()
    setIsRunning(false)
  }, [stopInterval])

  const reset = useCallback(() => {
    stopInterval()
    setIsRunning(false)
    setHasStarted(false)
    setPhase('work')
    setCompletedPomodoros(0)
    setTimeLeft(configRef.current.workMin * 60)
  }, [stopInterval])

  const skipPhase = useCallback(() => {
    stopInterval()
    setIsRunning(false)
    advancePhase(phaseRef.current, completedRef.current)
  }, [advancePhase, stopInterval])

  const setConfig = useCallback((next: PomodoroConfig) => {
    setConfigState(next)
    // If not running, update timeLeft to match new duration for current phase
    setIsRunning((running) => {
      if (!running) {
        setTimeLeft(phaseMinutes(phaseRef.current, next) * 60)
      }
      return running
    })
  }, [])

  // Cleanup on unmount
  useEffect(() => () => { stopInterval() }, [stopInterval])

  return { config, setConfig, phase, timeLeft, isRunning, hasStarted, completedPomodoros, start, pause, reset, skipPhase }
}
