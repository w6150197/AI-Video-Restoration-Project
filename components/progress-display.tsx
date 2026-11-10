'use client'

import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

interface ProgressDisplayProps {
  status: string
  progress: number
  statusMessage: string
  errorMessage?: string
}

export function ProgressDisplay({ status, progress, statusMessage, errorMessage }: ProgressDisplayProps) {
  if (status === 'PENDING' || (!status && !progress)) return null

  const icon = (() => {
    switch (status) {
      case 'PROCESSING':
        return <Loader2 className="h-5 w-5 text-[#FEBE10] animate-spin" />
      case 'COMPLETED':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case 'FAILED':
        return <XCircle className="h-5 w-5 text-destructive" />
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />
    }
  })()

  return (
    <div className={`p-4 rounded-xl border ${
      status === 'COMPLETED' ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' :
      status === 'FAILED' ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800' :
      'bg-[#FEBE10]/5 border-[#FEBE10]/20'
    }`}>
      <div className="flex items-center gap-3 mb-3">
        {icon}
        <span className="text-sm font-medium">{statusMessage || 'Processing...'}</span>
      </div>
      {status === 'PROCESSING' && (
        <Progress value={progress ?? 0} className="h-2 [&>div]:bg-[#FEBE10]" />
      )}
      {status === 'FAILED' && errorMessage && (
        <p className="text-xs text-destructive mt-2">{errorMessage}</p>
      )}
    </div>
  )
}
