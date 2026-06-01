import { useState, useRef, useEffect } from 'react'
import Tesseract from 'tesseract.js'
import jsQR from 'jsqr'
import { api } from '../api'
import Select from './Select'
import ReceiptCamera from './ReceiptCamera'
import { parseProverkachekaHTML } from '../receiptParser'

async function getQRCodeFromImage(dataUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      // If image is too large, it might have too much noise for jsQR
      // but let's try native resolution first with enhancement
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(null)
        return
      }
      ctx.drawImage(img, 0, 0)
      
      let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      
      // Preprocess: Convert to grayscale and boost contrast
      // jsQR likes high contrast
      const data = imageData.data
      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i+1] + data[i+2]) / 3
        // Simple thresholding/contrast boost
        const v = avg < 128 ? Math.max(0, avg - 40) : Math.min(255, avg + 40)
        data[i] = data[i+1] = data[i+2] = v
      }
      
      const code = jsQR(data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth'
      })
      resolve(code ? code.data : null)
    }
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}

interface Props {
  categories: string[]
  onClose: () => void
  onSaved: () => void
}

interface ScannedItem {
  name: string
  price: string
  quantity: number
  selected: boolean
}

interface ManualItem {
  name: string
  price: string
  quantity: string
}

type Mode = 'manual' | 'scan'

export default function AddTransactionModal({ categories, onClose, onSaved }: Props) {
  const [mode, setMode] = useState<Mode>('manual')

  // Manual form
  const [manualItems, setManualItems] = useState<ManualItem[]>([])
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [category, setCategory] = useState('')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [autoCategory, setAutoCategory] = useState(false)

  // Auto-suggest category with debounce
  useEffect(() => {
    if (mode !== 'manual' || name.trim().length < 3) return
    const timer = setTimeout(() => {
      api.suggestCategory(name.trim()).then((res) => {
        if (res.category) {
          setCategory(res.category)
          setAutoCategory(true)
        }
      }).catch(() => {})
    }, 400)
    return () => clearTimeout(timer)
  }, [name, mode])

  // Common date for manual items
  const [manualDate, setManualDate] = useState(new Date().toISOString().slice(0, 10))

  // Reset form when switching modes
  useEffect(() => {
    setManualItems([])
    setName('')
    setPrice('')
    setQuantity('1')
    setCategory('')
    setComment('')
    setAutoCategory(false)
  }, [mode])

  // Scan
  const [image, setImage] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([])
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editQuantity, setEditQuantity] = useState(1)
  const [scanCategory, setScanCategory] = useState('продукты')
  const [scanComment, setScanComment] = useState('')
  const [scanDate, setScanDate] = useState(new Date().toISOString().slice(0, 10))
  const fileRef = useRef<HTMLInputElement>(null)
  const [showCamera, setShowCamera] = useState(false)
  const [qrString, setQrString] = useState<string | null>(null)
  const [pastedHTML, setPastedHTML] = useState('')

  const addManualItem = () => {
    if (!name.trim() || !price) return
    setManualItems((prev) => [...prev, { name: name.trim(), price, quantity }])
    setName('')
    setPrice('')
    setQuantity('1')
    setAutoCategory(false)
  }

  const removeManualItem = (index: number) => {
    setManualItems((prev) => prev.filter((_, i) => i !== index))
  }

  const manualTotal = manualItems.reduce((sum, item) => {
    return sum + (parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 1)
  }, 0)

  async function saveAllManual() {
    if (!manualItems.length) return
    setSaving(true)
    try {
      for (const item of manualItems) {
        const p = parseFloat(item.price) || 0
        const q = parseFloat(item.quantity) || 1
        await api.createTransaction({
          name: item.name,
          date: manualDate,
          price: p,
          quantity: q,
          amount: p * q,
          category,
          comment,
        })
      }
      onSaved()
    } catch {
      alert('Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setImage(reader.result as string)
    reader.readAsDataURL(file)
  }

  function handleCameraCapture(dataUrl: string) {
    setImage(dataUrl)
    setShowCamera(false)
  }

  function handleQRCodeDetected(qrData: string, imageDataUrl: string) {
    setQrString(qrData)
    setImage(imageDataUrl)
    // When real-time QR is detected, let's keep the camera open for a second 
    // so user sees the "FOUND" state, then close it and show the result.
    setTimeout(() => {
      setShowCamera(false)
    }, 1000)
  }

  async function recognize() {
    if (!image) return
    setScanning(true)
    try {
      // Step 1: Detect QR Code (if not already detected by real-time)
      if (!qrString) {
        const qrData = await getQRCodeFromImage(image)
        if (qrData) {
          setQrString(qrData)
        }
      }

      // Step 2: OCR with Tesseract
      const { data } = await Tesseract.recognize(image, 'rus+eng', {})
      const ocrText = data.text

      if (!ocrText.trim()) {
        if (!qrString) alert('Не удалось распознать текст')
        setScanning(false)
        return
      }

      // Step 3: Parse with basic logic
      const result = await api.parseReceipt(ocrText)
      const items: ScannedItem[] = result.items.map((item) => ({
        name: item.name,
        price: String(item.price),
        quantity: item.quantity,
        selected: true,
      }))

      if (items.length > 0) {
        setScannedItems(items)
      } else if (!qrString) {
        alert('Не найдено товаров на чеке')
      }
    } catch {
      alert('Ошибка распознавания')
    } finally {
      setScanning(false)
    }
  }

  function handlePaste() {
    if (!pastedHTML.trim()) return
    const items = parseProverkachekaHTML(pastedHTML)
    if (items.length === 0) {
      alert('Не удалось извлечь товары из вставленного текста')
      return
    }
    
    const scanned: ScannedItem[] = items.map(item => ({
      ...item,
      selected: true
    }))
    
    setScannedItems(scanned)
    setPastedHTML('')
  }

  function toggleItem(i: number) {
    if (editingIndex === i) return // Don't toggle while editing
    setScannedItems((prev) =>
      prev.map((item, idx) => idx === i ? { ...item, selected: !item.selected } : item)
    )
  }

  function startEditing(i: number, e: React.MouseEvent) {
    e.stopPropagation()
    const item = scannedItems[i]
    setEditingIndex(i)
    setEditName(item.name)
    setEditPrice(item.price)
    setEditQuantity(item.quantity)
  }

  function cancelEdit(e: React.MouseEvent) {
    e.stopPropagation()
    setEditingIndex(null)
  }

  function saveEdit(e: React.MouseEvent) {
    e.stopPropagation()
    if (editingIndex === null) return
    setScannedItems((prev) =>
      prev.map((item, idx) =>
        idx === editingIndex
          ? { ...item, name: editName, price: editPrice, quantity: editQuantity }
          : item
      )
    )
    setEditingIndex(null)
  }

  async function saveScanned() {
    const selected = scannedItems.filter((i) => i.selected)
    if (!selected.length) return
    setSaving(true)
    try {
      for (const item of selected) {
        const p = parseFloat(item.price) || 0
        const q = item.quantity || 1
        await api.createTransaction({
          name: item.name,
          date: scanDate,
          price: p,
          quantity: q,
          amount: p * q,
          category: scanCategory,
          comment: scanComment,
        })
      }
      onSaved()
    } catch {
      alert('Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Новая запись</span>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>

        {/* Mode tabs */}
        <div className="tabs">
          <button className={`tab ${mode === 'manual' ? 'tab-active' : ''}`} onClick={() => setMode('manual')}>
            Вручную
          </button>
          <button className={`tab ${mode === 'scan' ? 'tab-active' : ''}`} onClick={() => setMode('scan')}>
            Сканировать чек
          </button>
        </div>

        {mode === 'manual' && (
          <>
            {/* Common fields: date and comment */}
            <input
              className="input"
              type="date"
              value={manualDate}
              onChange={(e) => setManualDate(e.target.value)}
            />
            <input
              className="input"
              placeholder="Комментарий (общий для всех товаров)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />

            {/* Item input section */}
            <div className="flex flex-col gap-3 pt-3 border-t border-[var(--color-border)]">
              <p className="text-sm font-medium">Добавить товар</p>
              <input
                className="input"
                placeholder="Название"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  placeholder="Цена"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  placeholder="Кол-во"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              {(parseFloat(price) || 0) * (parseFloat(quantity) || 1) > 0 && (
                <p className="text-sm font-semibold text-right">
                  Сумма: {((parseFloat(price) || 0) * (parseFloat(quantity) || 1)).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽
                </p>
              )}
              <Select
                value={category}
                onChange={(v) => { setCategory(v); setAutoCategory(false) }}
                placeholder="Категория..."
                options={categories.map((c) => ({ value: c, label: c }))}
              />
              {autoCategory && category && (
                <p className="text-muted -mt-2" style={{ color: 'var(--color-primary)' }}>
                  Автоподбор: {category}
                </p>
              )}
              <button
                className="btn btn-secondary w-full"
                disabled={!name.trim() || !price}
                onClick={addManualItem}
              >
                + Добавить товар
              </button>
            </div>

            {/* Items list */}
            {manualItems.length > 0 && (
              <div className="flex flex-col gap-2 pt-3 border-t border-[var(--color-border)]">
                <p className="text-muted text-sm">
                  {manualItems.length} товар(ов) · Итого: {manualTotal.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽
                </p>
                <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
                  {manualItems.map((item, i) => {
                    const itemSum = (parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 1)
                    return (
                      <div key={i} className="card-compact flex items-center gap-3">
                        <span className="text-sm flex-1 truncate">
                          {item.name}
                          {parseFloat(item.quantity) !== 1 && (
                            <span className="text-muted ml-1">x{item.quantity}</span>
                          )}
                        </span>
                        <span className="text-sm font-semibold tabular-nums">{itemSum.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽</span>
                        <button
                          className="w-6 h-6 flex items-center justify-center text-muted hover:text-[var(--color-danger)]"
                          onClick={() => removeManualItem(i)}
                        >
                          ✕
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Save all */}
            <button
              className="btn btn-primary w-full"
              disabled={!manualItems.length || saving}
              onClick={saveAllManual}
            >
              {saving ? 'Сохраняю...' : `Сохранить всё (${manualItems.length})`}
            </button>
          </>
        )}

        {mode === 'scan' && (
          <>
            {!image && !showCamera && (
              <div className="flex gap-3">
                <button className="btn btn-primary flex-1" onClick={() => setShowCamera(true)}>
                  Камера
                </button>
                <label className="btn btn-secondary flex-1 text-center cursor-pointer">
                  Файл
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
                </label>
              </div>
            )}

            {showCamera && (
              <ReceiptCamera
                onCapture={handleCameraCapture}
                onQRCodeDetected={handleQRCodeDetected}
                onClose={() => setShowCamera(false)}
              />
            )}

            {image && scannedItems.length === 0 && (
              <>
                <div className="rounded-2xl overflow-hidden border border-[var(--color-border)]">
                  <img src={image} alt="Чек" className="w-full" />
                </div>
                
                {qrString ? (
                  <div className="card bg-[var(--color-primary-light)] border-[var(--color-primary)] flex flex-col gap-2">
                    <p className="text-sm font-semibold text-[var(--color-primary)] flex items-center gap-2">
                      <span>✓ QR-код обнаружен!</span>
                    </p>
                    <p className="text-xs text-muted">
                      Для 100% точности нажмите кнопку ниже, скопируйте результат и вставьте его в поле ниже.
                    </p>
                    <a 
                      href={`https://proverkacheka.com/?qr=${encodeURIComponent(qrString)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary text-center py-2 text-sm no-underline"
                    >
                      Открыть на proverkacheka.com
                    </a>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button className="btn btn-primary flex-1" onClick={recognize} disabled={scanning}>
                      {scanning ? 'Распознаю...' : 'Распознать'}
                    </button>
                    <button className="btn btn-secondary" onClick={() => { setImage(null); setQrString(null) }}>
                      Заново
                    </button>
                  </div>
                )}

                <div className="flex flex-col gap-2 pt-2">
                  <p className="text-xs text-muted font-medium">Или вставьте результат (HTML/Текст):</p>
                  <textarea
                    className="input text-xs min-h-[60px] font-mono"
                    placeholder="Вставьте сюда содержимое страницы..."
                    value={pastedHTML}
                    onChange={(e) => setPastedHTML(e.target.value)}
                  />
                  <button 
                    className="btn btn-secondary py-2 text-xs"
                    disabled={!pastedHTML.trim()}
                    onClick={handlePaste}
                  >
                    Извлечь товары
                  </button>
                </div>
              </>
            )}

            {scannedItems.length > 0 && (
              <>
                <p className="text-muted">{scannedItems.filter((i) => i.selected).length} из {scannedItems.length} выбрано</p>
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
                  {scannedItems.map((item, i) => (
                    <div key={i} className="flex flex-col gap-2">
                      <div
                        onClick={() => toggleItem(i)}
                        className={`card-compact flex items-center gap-3 cursor-pointer transition-opacity ${!item.selected ? 'opacity-40' : ''}`}
                      >
                        <span className={`w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center text-xs ${
                          item.selected
                            ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                            : 'border-[var(--color-border)]'
                        }`}>
                          {item.selected && '✓'}
                        </span>
                        <span className="text-sm flex-1 truncate">
                          {item.name}
                          {item.quantity > 1 && <span className="text-muted ml-1">x{item.quantity}</span>}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold tabular-nums">{item.price} ₽</span>
                          <button
                            className="text-muted hover:text-[var(--color-primary)] p-1"
                            onClick={(e) => startEditing(i, e)}
                          >
                            ✎
                          </button>
                        </div>
                      </div>

                      {editingIndex === i && (
                        <div className="card-compact bg-[var(--color-surface-light)] border-[var(--color-primary)] flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            className="input"
                            style={{ padding: '8px 12px' }}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Название"
                            autoFocus
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              className="input"
                              style={{ padding: '8px 12px' }}
                              type="number"
                              value={editPrice}
                              onChange={(e) => setEditPrice(e.target.value)}
                              placeholder="Цена"
                            />
                            <input
                              className="input"
                              style={{ padding: '8px 12px' }}
                              type="number"
                              value={editQuantity}
                              onChange={(e) => setEditQuantity(Number(e.target.value))}
                              placeholder="Кол-во"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button className="btn btn-secondary flex-1 py-2 text-xs" onClick={cancelEdit}>Отмена</button>
                            <button className="btn btn-primary flex-1 py-2 text-xs" onClick={saveEdit}>Готово</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <input
                  className="input"
                  type="date"
                  value={scanDate}
                  onChange={(e) => setScanDate(e.target.value)}
                />
                <Select
                  value={scanCategory}
                  onChange={setScanCategory}
                  placeholder="Категория..."
                  options={categories.map((c) => ({ value: c, label: c }))}
                />
                <input
                  className="input"
                  placeholder="Комментарий (магазин и т.д.)"
                  value={scanComment}
                  onChange={(e) => setScanComment(e.target.value)}
                />
                <button
                  className="btn btn-primary w-full"
                  disabled={saving || !scannedItems.some((i) => i.selected)}
                  onClick={saveScanned}
                >
                  {saving ? 'Сохраняю...' : `Сохранить (${scannedItems.filter((i) => i.selected).length})`}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
