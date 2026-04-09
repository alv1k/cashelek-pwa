import { useState, useRef, useEffect, useCallback } from 'react'

interface Props {
  onCapture: (imageDataUrl: string) => void
  onClose: () => void
}

export default function ReceiptCamera({ onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [ready, setReady] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const [capturing, setCapturing] = useState(false)

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 2560 },
        },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setReady(true)
      }

      // Check torch support
      const track = stream.getVideoTracks()[0]
      const caps = track.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean }
      if (caps?.torch) {
        setTorchSupported(true)
      }
    } catch {
      alert('Нет доступа к камере')
      onClose()
    }
  }, [onClose])

  useEffect(() => {
    startCamera()
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
    } catch {}
  }

  function capture() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    setCapturing(true)

    // Capture at full video resolution
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0)

    // Enhance for receipt readability: boost contrast & sharpen
    enhanceForReceipt(ctx, canvas.width, canvas.height)

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)

    // Stop camera
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null

    // Brief flash animation, then return
    setTimeout(() => {
      onCapture(dataUrl)
    }, 200)
  }

  function enhanceForReceipt(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const imageData = ctx.getImageData(0, 0, w, h)
    const data = imageData.data

    // Increase contrast and brightness for receipt text
    const contrast = 1.3
    const brightness = 10
    const factor = (259 * (contrast * 128 + 255)) / (255 * (259 - contrast * 128))

    for (let i = 0; i < data.length; i += 4) {
      data[i] = clamp(factor * (data[i] - 128) + 128 + brightness)
      data[i + 1] = clamp(factor * (data[i + 1] - 128) + 128 + brightness)
      data[i + 2] = clamp(factor * (data[i + 2] - 128) + 128 + brightness)
    }

    ctx.putImageData(imageData, 0, 0)
  }

  function clamp(v: number) {
    return Math.max(0, Math.min(255, v))
  }

  return (
    <div className="receipt-camera">
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Video feed */}
      <video
        ref={videoRef}
        className="receipt-camera-video"
        playsInline
        muted
        autoPlay
      />

      {/* Frame overlay */}
      <div className="receipt-camera-overlay">
        <div className="receipt-camera-frame">
          {/* Corner marks */}
          <span className="frame-corner frame-tl" />
          <span className="frame-corner frame-tr" />
          <span className="frame-corner frame-bl" />
          <span className="frame-corner frame-br" />
        </div>
        <p className="receipt-camera-hint">Наведите камеру на чек</p>
      </div>

      {/* Capture flash */}
      {capturing && <div className="receipt-camera-flash" />}

      {/* Top bar */}
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

      {/* Bottom controls */}
      <div className="receipt-camera-bottom">
        <button
          className="receipt-camera-shutter"
          onClick={capture}
          disabled={!ready || capturing}
        >
          <span className="receipt-camera-shutter-inner" />
        </button>
      </div>
    </div>
  )
}
