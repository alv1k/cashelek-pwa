import { useRef, useState, useCallback } from 'react'
import Tesseract from 'tesseract.js'

interface ParsedItem {
  name: string
  price: string
}

export default function ReceiptPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [streaming, setStreaming] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [image, setImage] = useState<string | null>(null)
  const [rawText, setRawText] = useState('')
  const [items, setItems] = useState<ParsedItem[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setStreaming(true)
      setImage(null)
      setRawText('')
      setItems([])
    } catch {
      alert('Не удалось получить доступ к камере')
    }
  }, [])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setStreaming(false)
  }, [])

  const capture = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    setImage(dataUrl)
    stopCamera()
  }, [stopCamera])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setImage(reader.result as string)
      setRawText('')
      setItems([])
    }
    reader.readAsDataURL(file)
  }

  const recognize = async () => {
    if (!image) return
    setProcessing(true)
    try {
      const { data } = await Tesseract.recognize(image, 'rus+eng', {})
      setRawText(data.text)
      setItems(parseReceipt(data.text))
    } catch {
      alert('Ошибка распознавания')
    } finally {
      setProcessing(false)
    }
  }

  function parseReceipt(text: string): ParsedItem[] {
    const lines = text.split('\n').filter((l) => l.trim())
    const results: ParsedItem[] = []
    for (const line of lines) {
      const match = line.match(/(.+?)\s+([\d.,]+)\s*[₽р]?\s*$/)
      if (match) {
        results.push({ name: match[1].trim(), price: match[2].replace(',', '.') })
      }
    }
    return results
  }

  return (
    <div className="page">
      <h2 className="text-xl font-semibold tracking-tight">Сканер чеков</h2>

      {!image && !streaming && (
        <div className="flex gap-3">
          <button onClick={startCamera} className="btn btn-primary flex-1">
            Камера
          </button>
          <label className="btn btn-secondary flex-1 text-center cursor-pointer">
            Файл
            <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      )}

      {streaming && (
        <div className="relative rounded-2xl overflow-hidden border border-[var(--color-border)]">
          <video ref={videoRef} className="w-full" playsInline muted />
          <div className="absolute bottom-5 left-0 right-0 flex justify-center gap-4">
            <button
              onClick={capture}
              className="w-16 h-16 rounded-full bg-white border-4 border-[var(--color-primary)] shadow-lg"
            />
            <button
              onClick={stopCamera}
              className="w-12 h-12 rounded-full bg-[var(--color-surface)]/80 backdrop-blur text-[var(--color-text-muted)] self-center text-xl border border-[var(--color-border)]"
            >
              X
            </button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />

      {image && (
        <div className="space-y-4">
          <div className="rounded-2xl overflow-hidden border border-[var(--color-border)]">
            <img src={image} alt="Чек" className="w-full" />
          </div>
          <div className="flex gap-3">
            <button
              onClick={recognize}
              disabled={processing}
              className="btn btn-primary flex-1"
            >
              {processing ? 'Распознаю...' : 'Распознать текст'}
            </button>
            <button
              onClick={() => { setImage(null); setRawText(''); setItems([]) }}
              className="btn btn-secondary"
            >
              Заново
            </button>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-muted font-medium px-1">Найденные позиции</h3>
          {items.map((item, i) => (
            <div key={i} className="card-compact flex justify-between">
              <span className="text-sm">{item.name}</span>
              <span className="text-sm font-semibold tabular-nums">{item.price} ₽</span>
            </div>
          ))}
        </div>
      )}

      {rawText && (
        <details className="text-sm">
          <summary className="text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-text)] transition-colors">
            Сырой текст
          </summary>
          <pre className="card mt-3 text-xs whitespace-pre-wrap overflow-auto max-h-60">
            {rawText}
          </pre>
        </details>
      )}
    </div>
  )
}
