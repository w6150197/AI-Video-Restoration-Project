'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Wand2, Download, RotateCcw, Sparkles, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { VideoUpload } from '@/components/video-upload'
import { ProcessingControls } from '@/components/processing-controls'
import { VideoComparison } from '@/components/video-comparison'
import { ProgressDisplay } from '@/components/progress-display'
import { FadeIn, SlideIn } from '@/components/ui/animate'
import { toast } from 'sonner'

interface UploadData {
  cloud_storage_path: string
  fileName: string
  contentType: string
}

interface JobStatus {
  id: string
  status: string
  progress: number
  statusMessage: string
  outputPath: string
  outputIsPublic: boolean
  maskPath?: string
  errorMessage: string
}

function getVideoDuration(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const v = document.createElement('video')
    v.preload = 'metadata'
    const done = (d: number | null) => { v.removeAttribute('src'); v.load(); resolve(d) }
    v.onloadedmetadata = () => done(Number.isFinite(v.duration) && v.duration > 0 ? v.duration : null)
    v.onerror = () => done(null)
    setTimeout(() => done(null), 15000)
    v.src = url
  })
}

export function RestorationApp() {
  // Upload state
  const [uploadData, setUploadData] = useState<UploadData | null>(null)

  // Processing params
  const [sensitivity, setSensitivity] = useState(30)
  const [stability, setStability] = useState(70)
  const [inpaintRadius, setInpaintRadius] = useState(5)
  const [denoiseStrength, setDenoiseStrength] = useState(10)

  // Job state
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Video URLs
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const [restoredUrl, setRestoredUrl] = useState<string | null>(null)

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Fetch original video URL when uploaded
  const handleUploadComplete = useCallback(async (data: UploadData) => {
    setUploadData(data)
    setRestoredUrl(null)
    setJobId(null)
    setJobStatus(null)

    // Create a temporary job to get the input URL
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputPath: data?.cloud_storage_path,
          originalName: data?.fileName,
          contentType: data?.contentType,
          sensitivity,
          stability,
          inpaintRadius,
          denoiseStrength,
        }),
      })
      const jobData = await res.json()
      if (jobData?.jobId) {
        setJobId(jobData.jobId)
        // Get the video URL for preview
        const urlRes = await fetch(`/api/jobs/${jobData.jobId}/input-url`)
        const urlData = await urlRes.json()
        if (urlData?.url) {
          setOriginalUrl(urlData.url)
        }
      }
    } catch (err: any) {
      console.error('Failed to create job:', err)
    }
  }, [sensitivity, stability, inpaintRadius, denoiseStrength])

  // Start processing
  const startProcessing = useCallback(async () => {
    if (!jobId) {
      toast.error('Please upload a video first')
      return
    }

    setIsProcessing(true)
    setRestoredUrl(null)

    try {
      // Update job with current params
      const updateRes = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputPath: uploadData?.cloud_storage_path,
          originalName: uploadData?.fileName,
          contentType: uploadData?.contentType,
          sensitivity,
          stability,
          inpaintRadius,
          denoiseStrength,
        }),
      })
      const newJobData = await updateRes.json()
      const activeJobId = newJobData?.jobId ?? jobId
      setJobId(activeJobId)

      // Clip length lets the server sample frames evenly across the whole video
      const duration = originalUrl ? await getVideoDuration(originalUrl) : null

      // Fire off processing (non-blocking from the UI side)
      fetch(`/api/jobs/${activeJobId}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration }),
      }).catch(() => {})

      // Start polling
      if (pollingRef.current) clearInterval(pollingRef.current)
      pollingRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/jobs/${activeJobId}/status`)
          const statusData = await statusRes.json()
          setJobStatus(statusData)

          if (statusData?.status === 'COMPLETED') {
            if (pollingRef.current) clearInterval(pollingRef.current)
            setIsProcessing(false)

            // Get restored video URL
            if (statusData?.outputPath) {
              setRestoredUrl(statusData.outputPath)
            }
            toast.success('Video restoration complete!')
          } else if (statusData?.status === 'FAILED') {
            if (pollingRef.current) clearInterval(pollingRef.current)
            setIsProcessing(false)
            toast.error(statusData?.errorMessage ?? 'Processing failed')
          }
        } catch (e: any) {
          console.error('Polling error:', e)
        }
      }, 2000)
    } catch (err: any) {
      setIsProcessing(false)
      toast.error(err?.message ?? 'Failed to start processing')
    }
  }, [jobId, uploadData, originalUrl, sensitivity, stability, inpaintRadius, denoiseStrength])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [])

  // Download handler
  const handleDownload = useCallback(async () => {
    if (!jobId) return

    try {
      const res = await fetch(`/api/jobs/${jobId}/download`)
      const data = await res.json()
      if (data?.url) {
        const a = document.createElement('a')
        a.href = data.url
        a.download = `restored_${data?.originalName ?? 'video.mp4'}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      } else {
        toast.error('Download not available yet')
      }
    } catch (err: any) {
      toast.error('Download failed')
    }
  }, [jobId])

  // Reset
  const handleReset = useCallback(() => {
    if (pollingRef.current) clearInterval(pollingRef.current)
    setUploadData(null)
    setJobId(null)
    setJobStatus(null)
    setIsProcessing(false)
    setOriginalUrl(null)
    setRestoredUrl(null)
    setSensitivity(30)
    setStability(70)
    setInpaintRadius(5)
    setDenoiseStrength(10)
  }, [])

  const isCompleted = jobStatus?.status === 'COMPLETED'

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-8 space-y-8">
      {/* Hero Section */}
      <FadeIn>
        <div className="text-center space-y-3 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FEBE10]/10 text-[#002C72] dark:text-[#FEBE10] text-xs font-medium">
            <Sparkles className="h-3 w-3" />
            AI-Powered Computer Vision
          </div>
          <h2 className="text-3xl md:text-4xl font-display font-bold tracking-tight">
            Lens Spot <span className="text-[#FEBE10]">Removal</span> Tool
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Automatically detect and remove stationary black spots caused by dirty or damaged camera lenses.
            Upload your footage, adjust settings, and download the restored video for Adobe Premiere Pro.
          </p>
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Upload + Controls */}
        <div className="lg:col-span-1 space-y-6">
          <SlideIn from="left">
            <Card>
              <CardContent className="p-5 space-y-6">
                {/* Upload */}
                <div>
                  <h3 className="text-sm font-display font-semibold tracking-tight mb-3 flex items-center gap-2">
                    <Wand2 className="h-4 w-4 text-[#FEBE10]" />
                    Upload Video
                  </h3>
                  <VideoUpload
                    onUploadComplete={handleUploadComplete}
                    disabled={isProcessing}
                  />
                </div>

                {/* Divider */}
                <div className="border-t border-border" />

                {/* Controls */}
                <ProcessingControls
                  sensitivity={sensitivity}
                  stability={stability}
                  inpaintRadius={inpaintRadius}
                  denoiseStrength={denoiseStrength}
                  onSensitivityChange={setSensitivity}
                  onStabilityChange={setStability}
                  onInpaintRadiusChange={setInpaintRadius}
                  onDenoiseStrengthChange={setDenoiseStrength}
                  disabled={isProcessing}
                />

                {/* Action Buttons */}
                <div className="space-y-3">
                  <Button
                    onClick={startProcessing}
                    disabled={!uploadData || isProcessing}
                    className="w-full bg-[#002C72] hover:bg-[#002C72]/90 text-[#FEBE10] font-semibold"
                    size="lg"
                  >
                    {isProcessing ? (
                      <>
                        <span className="animate-spin mr-2">⚙️</span>
                        Processing...
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4 mr-2" />
                        Process Video
                      </>
                    )}
                  </Button>

                  {isCompleted && (
                    <Button
                      onClick={handleDownload}
                      className="w-full bg-[#FEBE10] hover:bg-[#FEBE10]/90 text-[#002C72] font-semibold"
                      size="lg"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Restored Video
                    </Button>
                  )}

                  {(uploadData || jobId) && (
                    <Button
                      onClick={handleReset}
                      variant="outline"
                      className="w-full"
                      disabled={isProcessing}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Start Over
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </SlideIn>

          {/* Info Card */}
          <SlideIn from="left" delay={0.1}>
            <Card className="bg-[#002C72]/5 dark:bg-[#002C72]/20 border-[#002C72]/10">
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <AlertTriangle className="h-4 w-4 text-[#FEBE10] flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">Tips for Best Results</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li>Moving footage is supported: only spots that stay fixed in the frame are removed</li>
                      <li>Start with default settings, then check the detected spot mask</li>
                      <li>Locked-off shot? Raise stability if dark scenery gets flagged</li>
                      <li>Lower sensitivity = fewer spots detected</li>
                      <li>Higher inpainting radius for larger spots</li>
                      <li>Output is H.264 MP4, ready for Premiere Pro</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </SlideIn>
        </div>

        {/* Right Column: Preview + Progress */}
        <div className="lg:col-span-2 space-y-6">
          <SlideIn from="right">
            <Card>
              <CardContent className="p-5">
                <h3 className="text-sm font-display font-semibold tracking-tight mb-4">Video Preview</h3>
                <VideoComparison
                  originalUrl={originalUrl}
                  restoredUrl={restoredUrl}
                />
              </CardContent>
            </Card>
          </SlideIn>

          {jobStatus?.maskPath && (
            <FadeIn>
              <Card>
                <CardContent className="p-5">
                  <h3 className="text-sm font-display font-semibold tracking-tight mb-1">Detected Lens Spots</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    White areas are the fixed spots that get repaired in every frame. Moving objects are ignored. If scenery is flagged, raise Spot Stability or lower Sensitivity.
                  </p>
                  <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
                    <img src={jobStatus.maskPath} alt="Mask of detected stationary lens spots" className="w-full h-full object-contain" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                  </div>
                </CardContent>
              </Card>
            </FadeIn>
          )}

          {/* Progress */}
          {(isProcessing || isCompleted || jobStatus?.status === 'FAILED') && (
            <FadeIn>
              <ProgressDisplay
                status={jobStatus?.status ?? ''}
                progress={jobStatus?.progress ?? 0}
                statusMessage={jobStatus?.statusMessage ?? ''}
                errorMessage={jobStatus?.errorMessage}
              />
            </FadeIn>
          )}

          {/* Completed Info */}
          {isCompleted && (
            <FadeIn>
              <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Download className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-green-800 dark:text-green-200">
                        Restoration Complete
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                        Your restored video is ready. Download it and import into Adobe Premiere Pro for final editing.
                        The output uses H.264 encoding with high quality settings (CRF 18) for professional workflows.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </FadeIn>
          )}
        </div>
      </div>
    </div>
  )
}
