'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import {
  Camera,
  FlipHorizontal,
  Zap,
  ZapOff,
  ImageIcon,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  StopCircle,
  CameraOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CameraScannerProps {
  onCapture: (imageBase64: string) => void
  isScanning: boolean
}

type PermissionState = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable' | 'busy' | 'nosupport'

export function CameraScanner({ onCapture, isScanning }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [permission, setPermission] = useState<PermissionState>('idle')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [flashOn, setFlashOn] = useState(false)
  const [streamReady, setStreamReady] = useState(false)

  // ── Attach stream to <video> via useEffect so the element is always mounted ──
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (streamRef.current) {
      video.srcObject = streamRef.current
      video.play().catch(() => {
        // Autoplay blocked — muted + playsInline should cover it
      })
    } else {
      video.srcObject = null
    }
  }, [streamReady]) // triggers whenever we toggle streamReady

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setStreamReady(false)
    setPermission('idle')
    setFlashOn(false)
  }, [])

  const startCamera = useCallback(async (facing: 'environment' | 'user' = 'environment') => {
    // Stop any prior stream first
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      setStreamReady(false)
    }

    // Check API availability
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setPermission('nosupport')
      setErrorMsg('Browser kamu tidak mendukung akses kamera. Gunakan Chrome, Firefox, atau Safari terbaru.')
      return
    }

    setPermission('requesting')
    setErrorMsg('')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })

      streamRef.current = stream
      setPermission('granted')
      setStreamReady((prev) => !prev) // toggle to fire the useEffect

    } catch (err: unknown) {
      const error = err as DOMException
      streamRef.current = null
      setStreamReady(false)

      const name = error?.name || ''
      const msg = error?.message || ''

      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setPermission('denied')
        setErrorMsg(
          'Akses kamera ditolak. Izinkan kamera di pengaturan browser:\n• Chrome: klik ikon kunci di address bar → Camera → Allow\n• Safari: Settings → Safari → Camera → Allow\nLalu reload halaman dan coba lagi.'
        )
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setPermission('unavailable')
        setErrorMsg('Tidak ada kamera yang terdeteksi. Pastikan kamera terpasang dan tidak diblokir.')
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        setPermission('busy')
        setErrorMsg('Kamera sedang digunakan aplikasi lain. Tutup aplikasi lain yang memakai kamera, lalu coba lagi.')
      } else if (name === 'OverconstrainedError') {
        // Retry with no constraints
        try {
          const fallback = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
          streamRef.current = fallback
          setPermission('granted')
          setStreamReady((prev) => !prev)
        } catch (e2: unknown) {
          const e = e2 as DOMException
          setPermission('unavailable')
          setErrorMsg('Kamera tidak cocok dengan pengaturan ini: ' + (e?.message || ''))
        }
      } else if (name === 'SecurityError') {
        setPermission('denied')
        setErrorMsg('Kamera diblokir oleh kebijakan keamanan. Pastikan situs menggunakan HTTPS.')
      } else {
        setPermission('unavailable')
        setErrorMsg(`Gagal mengakses kamera: ${name || msg || 'Unknown error'}`)
      }
    }
  }, [])

  const handleCapture = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    if (video.readyState < 2) return

    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    const base64 = canvas.toDataURL('image/jpeg', 0.92)
    onCapture(base64)
  }, [onCapture])

  const handleFlipCamera = useCallback(() => {
    const next: 'environment' | 'user' = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(next)
    startCamera(next)
  }, [facingMode, startCamera])

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string
        onCapture(base64)
      }
      reader.readAsDataURL(file)
      e.target.value = ''
    },
    [onCapture]
  )

  const toggleFlash = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    try {
      // @ts-expect-error torch not in standard TS types
      await track.applyConstraints({ advanced: [{ torch: !flashOn }] })
      setFlashOn((f) => !f)
    } catch {
      // Flash not supported on this device
    }
  }, [flashOn])

  const isCameraActive = permission === 'granted'

  // ── Error state icon & color helper ──
  const errorIcon = () => {
    if (permission === 'denied') return <ShieldAlert className="w-10 h-10 text-red-400" />
    if (permission === 'nosupport') return <CameraOff className="w-10 h-10 text-orange-400" />
    return <AlertTriangle className="w-10 h-10 text-yellow-400" />
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Camera viewport */}
      <div className="relative rounded-2xl overflow-hidden bg-neutral-950 aspect-video w-full shadow-xl border border-border">
        {/* Video element: ALWAYS in DOM so ref is stable */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isCameraActive ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'
          }`}
        />

        {/* Overlay when camera NOT active */}
        {!isCameraActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            {permission === 'requesting' && (
              <>
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                  <Camera className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Meminta izin kamera...</p>
                  <p className="text-xs text-white/60 mt-1">
                    Izinkan akses kamera pada popup yang muncul di browser
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-white/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </>
            )}

            {permission === 'idle' && (
              <>
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                  <Camera className="w-8 h-8 text-white/60" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Kamera belum aktif</p>
                  <p className="text-xs text-white/50 mt-1">
                    Tekan &quot;Mulai Kamera&quot; untuk mengaktifkan
                  </p>
                </div>
              </>
            )}

            {(permission === 'denied' || permission === 'unavailable' || permission === 'busy' || permission === 'nosupport') && (
              <>
                {errorIcon()}
                <div>
                  <p className="text-sm font-semibold text-white mb-1">
                    {permission === 'denied' && 'Izin Kamera Ditolak'}
                    {permission === 'unavailable' && 'Kamera Tidak Tersedia'}
                    {permission === 'busy' && 'Kamera Sedang Digunakan'}
                    {permission === 'nosupport' && 'Kamera Tidak Didukung'}
                  </p>
                  {errorMsg && (
                    <p className="text-xs text-white/70 max-w-xs whitespace-pre-line leading-relaxed">
                      {errorMsg}
                    </p>
                  )}
                </div>
                {permission !== 'nosupport' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => startCamera(facingMode)}
                    className="gap-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Coba Lagi
                  </Button>
                )}
                {/* Upload as fallback always visible */}
                <p className="text-xs text-white/40">
                  Atau gunakan &quot;Upload Gambar&quot; di bawah
                </p>
              </>
            )}
          </div>
        )}

        {/* Scan corners + animation when active */}
        {isCameraActive && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-primary rounded-tl" />
            <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-primary rounded-tr" />
            <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-primary rounded-bl" />
            <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-primary rounded-br" />

            {isScanning && (
              <>
                <div
                  className="absolute inset-x-4 h-0.5 bg-primary/90 animate-scan"
                  style={{ boxShadow: '0 0 8px 2px oklch(0.52 0.22 260 / 0.5)' }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex items-center gap-2 bg-black/60 text-white text-xs px-4 py-2 rounded-full backdrop-blur-sm">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    Menganalisis kanji...
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Top-right controls */}
        {isCameraActive && (
          <div className="absolute top-3 right-3 flex gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleFlash}
              title={flashOn ? 'Matikan flash' : 'Nyalakan flash'}
              className="w-9 h-9 bg-black/40 hover:bg-black/60 text-white backdrop-blur-sm rounded-full"
            >
              {flashOn
                ? <Zap className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                : <ZapOff className="w-4 h-4" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleFlipCamera}
              title="Ganti kamera"
              className="w-9 h-9 bg-black/40 hover:bg-black/60 text-white backdrop-blur-sm rounded-full"
            >
              <FlipHorizontal className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Hidden canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Action buttons */}
      <div className="flex gap-3 flex-wrap">
        {!isCameraActive ? (
          <Button
            onClick={() => startCamera(facingMode)}
            className="flex-1 gap-2"
            size="lg"
            disabled={permission === 'requesting' || permission === 'nosupport'}
          >
            <Camera className="w-5 h-5" />
            {permission === 'requesting' ? 'Meminta Izin...' : 'Mulai Kamera'}
          </Button>
        ) : (
          <>
            <Button
              onClick={handleCapture}
              disabled={isScanning}
              className="flex-1 gap-2"
              size="lg"
            >
              <Camera className="w-5 h-5" />
              {isScanning ? 'Menganalisis...' : 'Scan Kanji'}
            </Button>
            <Button
              onClick={stopCamera}
              variant="outline"
              size="lg"
              className="gap-2"
            >
              <StopCircle className="w-4 h-4" />
              Stop
            </Button>
          </>
        )}

        <Button
          onClick={() => fileInputRef.current?.click()}
          variant="outline"
          size="lg"
          disabled={isScanning}
          className="gap-2 flex-1"
        >
          <ImageIcon className="w-4 h-4" />
          Upload Gambar
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>
    </div>
  )
}
