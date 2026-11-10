'use client'

import { useState, useCallback, useRef } from 'react'
import { Upload, Film, X, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface VideoUploadProps {
  onUploadComplete: (data: { cloud_storage_path: string; fileName: string; contentType: string }) => void
  disabled?: boolean
}

const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/avi']
const MAX_SIZE = 2 * 1024 * 1024 * 1024 // 2GB
const MULTIPART_THRESHOLD = 100 * 1024 * 1024 // 100MB
const CHUNK_SIZE = 50 * 1024 * 1024 // 50MB chunks

export function VideoUpload({ onUploadComplete, disabled }: VideoUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const validateFile = useCallback((file: File): string | null => {
    if (!file) return 'No file selected'
    if (file.size > MAX_SIZE) return 'File too large. Maximum size is 2GB.'
    // Accept common video types and also files with video extensions
    const ext = file?.name?.split('.')?.pop()?.toLowerCase() ?? ''
    const validExts = ['mp4', 'mov', 'avi', 'mkv']
    if (!ACCEPTED_TYPES.includes(file.type) && !validExts.includes(ext)) {
      return 'Please upload a video file (MP4, MOV, AVI, or MKV)'
    }
    return null
  }, [])

  const uploadSinglePart = useCallback(async (file: File) => {
    const contentType = file.type || 'video/mp4'
    // Get presigned URL
    const presignedRes = await fetch('/api/upload/presigned', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: file.name, contentType }),
    })
    const presignedData = await presignedRes.json()
    if (!presignedData?.uploadUrl) throw new Error('Failed to get upload URL')

    // Upload to S3
    setUploadProgress(10)
    const uploadRes = await fetch(presignedData.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: file,
    })
    if (!uploadRes.ok) throw new Error('Upload to storage failed')
    setUploadProgress(100)

    return {
      cloud_storage_path: presignedData.cloud_storage_path,
      fileName: file.name,
      contentType,
    }
  }, [])

  const uploadMultipart = useCallback(async (file: File) => {
    const contentType = file.type || 'video/mp4'
    // Initiate
    const initRes = await fetch('/api/upload/multipart/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: file.name, contentType }),
    })
    const initData = await initRes.json()
    if (!initData?.uploadId) throw new Error('Failed to initiate multipart upload')

    const { uploadId, cloud_storage_path } = initData
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
    const parts: { ETag: string; PartNumber: number }[] = []

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE
      const end = Math.min(start + CHUNK_SIZE, file.size)
      const chunk = file.slice(start, end)

      // Get presigned URL for this part
      const partRes = await fetch('/api/upload/multipart/part', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cloud_storage_path, uploadId, partNumber: i + 1 }),
      })
      const partData = await partRes.json()
      if (!partData?.url) throw new Error(`Failed to get URL for part ${i + 1}`)

      // Upload chunk
      const uploadRes = await fetch(partData.url, {
        method: 'PUT',
        body: chunk,
      })
      if (!uploadRes.ok) throw new Error(`Failed to upload part ${i + 1}`)

      const etag = uploadRes.headers.get('ETag') ?? ''
      parts.push({ ETag: etag, PartNumber: i + 1 })
      setUploadProgress(Math.round(((i + 1) / totalChunks) * 90))
    }

    // Complete
    const completeRes = await fetch('/api/upload/multipart/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cloud_storage_path, uploadId, parts }),
    })
    if (!completeRes.ok) throw new Error('Failed to complete multipart upload')

    setUploadProgress(100)
    return { cloud_storage_path, fileName: file.name, contentType }
  }, [])

  const handleFile = useCallback(async (file: File) => {
    const error = validateFile(file)
    if (error) {
      toast.error(error)
      return
    }

    setSelectedFile(file)
    setUploading(true)
    setUploadProgress(0)

    try {
      let result: { cloud_storage_path: string; fileName: string; contentType: string }
      if (file.size > MULTIPART_THRESHOLD) {
        result = await uploadMultipart(file)
      } else {
        result = await uploadSinglePart(file)
      }
      toast.success('Video uploaded successfully!')
      onUploadComplete(result)
    } catch (err: any) {
      toast.error(err?.message ?? 'Upload failed')
      setSelectedFile(null)
    } finally {
      setUploading(false)
    }
  }, [validateFile, uploadSinglePart, uploadMultipart, onUploadComplete])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e?.dataTransfer?.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const clearFile = useCallback(() => {
    setSelectedFile(null)
    setUploadProgress(0)
    if (inputRef.current) inputRef.current.value = ''
  }, [])

  return (
    <div className="w-full">
      {selectedFile && uploadProgress >= 100 ? (
        <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/30 rounded-xl border border-green-200 dark:border-green-800">
          <Film className="h-5 w-5 text-green-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-800 dark:text-green-200 truncate">
              {selectedFile?.name ?? 'video'}
            </p>
            <p className="text-xs text-green-600 dark:text-green-400">
              {((selectedFile?.size ?? 0) / (1024 * 1024)).toFixed(1)} MB &middot; Ready for processing
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={clearFile} disabled={disabled}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !uploading && !disabled && inputRef?.current?.click?.()}
          className={`
            relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200
            ${isDragging ? 'border-[#FEBE10] bg-[#FEBE10]/5' : 'border-[#D2C4C3] hover:border-[#FEBE10]/50 hover:bg-muted/50'}
            ${(uploading || disabled) ? 'pointer-events-none opacity-50' : ''}
          `}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".mp4,.mov,.avi,.mkv,video/*"
            onChange={(e) => {
              const f = e?.target?.files?.[0]
              if (f) handleFile(f)
            }}
            className="hidden"
          />
          <div className="flex flex-col items-center gap-3">
            {uploading ? (
              <>
                <div className="animate-pulse">
                  <Upload className="h-10 w-10 text-[#FEBE10]" />
                </div>
                <p className="text-sm font-medium">Uploading... {uploadProgress}%</p>
                <div className="w-full max-w-xs h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#FEBE10] rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </>
            ) : (
              <>
                <Upload className="h-10 w-10 text-[#002C72] dark:text-[#FEBE10]" />
                <div>
                  <p className="text-sm font-medium">Drop your video file here or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports MP4, MOV, AVI, MKV &middot; Max 2GB
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
