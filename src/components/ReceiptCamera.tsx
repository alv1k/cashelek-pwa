import { useState, useRef, useEffect, useCallback } from 'react'
import jsQR from 'jsqr'

interface Props {
  onCapture: (imageDataUrl: string) => void
  onQRCodeDetected?: (qrData: string, imageDataUrl: string) => void
  onClose: () => void
}

export default function ReceiptCamera({ onCapture, onQRCodeDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [ready, setReady] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [qrDetected, setQrDetected] = useState(false)

  const scanFrame = useCallback(() => {
    if (!videoRef.current || !onQRCodeDetected || qrDetected) return

    const video = videoRef.current
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        })

        if (code) {
          setQrDetected(true)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
          onQRCodeDetected(code.data, dataUrl)
          // Don't stop the loop immediately, let the parent handle it
        }
      }
    }

    if (!qrDetected) {
      requestAnimationFrame(scanFrame)
    }
  }, [onQRCodeDetected, qrDetected])

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          // Try to stabilize exposure
          advanced: [
            { exposureMode: 'continuous' } as any,
            { whiteBalanceMode: 'continuous' } as any,
            { focusMode: 'continuous' } as any
          ]
        },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setReady(true)
        
        // Start scanning loop if callback is provided
        if (onQRCodeDetected) {
          requestAnimationFrame(scanFrame)
        }
      }

      // Check torch support
      const track = stream.getVideoTracks()[0]
      const caps = track.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean }
      if (caps?.torch) {
        setTorchSupported(true)
      }
    } catch (e) {
      console.error('Camera error:', e)
      alert('Нет доступа к камере или ошибка инициализации')
      onClose()
    }
  }, [onClose, onQRCodeDetected, scanFrame])

  useEffect(() => {
    void startCamera()
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [startCamera])

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    const next = !torchOn
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet & { torch: boolean }],
      })
      setTorchOn(next)
    } catch (e) {
      console.warn('Failed to toggle torch', e)
    }
  }

  function capture() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    setCapturing(true)

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0)

    // Apply a more subtle enhancement
    enhanceForReceipt(ctx, canvas.width, canvas.height)

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)

    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null

    setTimeout(() => {
      onCapture(dataUrl)
    }, 150)
  }

  function enhanceForReceipt(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const imageData = ctx.getImageData(0, 0, w, h)
    const data = imageData.data

    // Simple auto-contrast: find min/max brightness
    let min = 255
    let max = 0
    for (let i = 0; i < data.length; i += 40) { // faster sampling
      const b = (data[i] + data[i + 1] + data[i + 2]) / 3
      if (b < min) min = b
      if (b > max) max = b
    }

    // Only apply if there's enough range to expand
    if (max - min > 30 && max - min < 240) {
      const factor = 255 / (max - min)
      for (let i = 0; i < data.length; i += 4) {
        data[i] = (data[i] - min) * factor
        data[i + 1] = (data[i + 1] - min) * factor
        data[i + 2] = (data[i + 2] - min) * factor
      }
      ctx.putImageData(imageData, 0, 0)
    }
  }

  return (
    <div className="receipt-camera">
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <video
        ref={videoRef}
        className="receipt-camera-video"
        playsInline
        muted
        autoPlay
      />

      <div className="receipt-camera-overlay">
        <div className={`receipt-camera-frame ${qrDetected ? 'border-[var(--color-primary)] shadow-[0_0_20px_var(--color-primary)]' : ''}`}>
          <span className="frame-corner frame-tl" />
          <span className="frame-corner frame-tr" />
          <span className="frame-corner frame-bl" />
          <span className="frame-corner frame-br" />
          {qrDetected && (
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-primary)]/10">
              <span className="text-white font-bold text-lg bg-[var(--color-primary)] px-4 py-2 rounded-full shadow-lg">
                QR-КОД НАЙДЕН
              </span>
            </div>
          )}
        </div>
        <p className="receipt-camera-hint">
          {qrDetected ? 'Обработка чека...' : 'Наведите камеру на QR-код или текст'}
        </p>
      </div>

      {capturing && <div className="receipt-camera-flash" />}

      <div className="receipt-camera-topbar">
        <button className="receipt-camera-btn" onClick={onClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {torchSupported && (
          <button
            className={`receipt-camera-btn ${torchOn ? 'receipt-camera-btn-active' : ''}`}
            onClick={toggleTorch}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill={torchOn ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </button>
        )}
      </div>

      <div className="receipt-camera-bottom">
        <button
          className="receipt-camera-shutter"
          onClick={capture}
          disabled={!ready || capturing || qrDetected}
        >
          <span className="receipt-camera-shutter-inner" />
        </button>
      </div>
    </div>
  )
}

