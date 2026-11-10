'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Play, Pause, RotateCcw, Volume2, VolumeX, Maximize } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface VideoComparisonProps {
  originalUrl: string | null
  restoredUrl: string | null
}

export function VideoComparison({ originalUrl, restoredUrl }: VideoComparisonProps) {
  const originalRef = useRef<HTMLVideoElement>(null)
  const restoredRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const syncingRef = useRef(false)

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      originalRef?.current?.pause?.()
      restoredRef?.current?.pause?.()
    } else {
      originalRef?.current?.play?.()?.catch(() => {})
      restoredRef?.current?.play?.()?.catch(() => {})
    }
    setIsPlaying(!isPlaying)
  }, [isPlaying])

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      if (originalRef.current) originalRef.current.muted = !prev
      if (restoredRef.current) restoredRef.current.muted = !prev
      return !prev
    })
  }, [])

  const restart = useCallback(() => {
    if (originalRef.current) {
      originalRef.current.currentTime = 0
    }
    if (restoredRef.current) {
      restoredRef.current.currentTime = 0
    }
    setCurrentTime(0)
  }, [])

  // Sync playback times
  useEffect(() => {
    const orig = originalRef.current
    if (!orig) return

    const handleTimeUpdate = () => {
      if (syncingRef.current) return
      setCurrentTime(orig?.currentTime ?? 0)

      const restored = restoredRef.current
      if (restored && Math.abs((restored?.currentTime ?? 0) - (orig?.currentTime ?? 0)) > 0.3) {
        syncingRef.current = true
        restored.currentTime = orig?.currentTime ?? 0
        setTimeout(() => { syncingRef.current = false }, 100)
      }
    }

    const handleDurationChange = () => {
      setDuration(orig?.duration ?? 0)
    }

    const handleEnded = () => {
      setIsPlaying(false)
    }

    orig.addEventListener('timeupdate', handleTimeUpdate)
    orig.addEventListener('durationchange', handleDurationChange)
    orig.addEventListener('ended', handleEnded)

    return () => {
      orig.removeEventListener('timeupdate', handleTimeUpdate)
      orig.removeEventListener('durationchange', handleDurationChange)
      orig.removeEventListener('ended', handleEnded)
    }
  }, [originalUrl])

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return '0:00'
    const mins = Math.floor(time / 60)
    const secs = Math.floor(time % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const hasOriginal = !!originalUrl
  const hasRestored = !!restoredUrl

  if (!hasOriginal && !hasRestored) {
    return (
      <div className="w-full aspect-video bg-muted/50 rounded-xl flex items-center justify-center border border-dashed border-border">
        <div className="text-center">
          <Play className="h-12 w-12 mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">Upload a video to see the preview</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className={`grid ${hasRestored ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'} gap-4`}>
        {/* Original Video */}
        {hasOriginal && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-red-500" />
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Original</span>
            </div>
            <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
              <video
                ref={originalRef}
                src={originalUrl ?? undefined}
                className="w-full h-full object-contain"
                muted={isMuted}
                playsInline
                preload="metadata"
              />
            </div>
          </div>
        )}

        {/* Restored Video */}
        {hasRestored && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Restored</span>
            </div>
            <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
              <video
                ref={restoredRef}
                src={restoredUrl ?? undefined}
                className="w-full h-full object-contain"
                muted={isMuted}
                playsInline
                preload="metadata"
              />
            </div>
          </div>
        )}
      </div>

      {/* Playback Controls */}
      <div className="flex items-center gap-3 p-3 bg-card rounded-lg border">
        <Button variant="ghost" size="icon-sm" onClick={togglePlay} disabled={!hasOriginal}>
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={restart} disabled={!hasOriginal}>
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={toggleMute} disabled={!hasOriginal}>
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>

        {/* Progress bar */}
        <div className="flex-1 flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground w-10 text-right">
            {formatTime(currentTime)}
          </span>
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-[#FEBE10] rounded-full transition-all"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>
          <span className="text-xs font-mono text-muted-foreground w-10">
            {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  )
}
