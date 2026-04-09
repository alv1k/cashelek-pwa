import { useState, useRef, useEffect } from 'react'
import Tesseract from 'tesseract.js'
import { api } from '../api'
import Select from './Select'
import ReceiptCamera from './ReceiptCamera'

interface Props {
  categories: string[]
  onClose: () => void
  onSaved: () => void
}

interface ScannedItem {
  name: string
  price: string
  selected: boolean
}

type Mode = 'manual' | 'scan'

export default function AddTransactionModal({ categories, onClose, onSaved }: Props) {
  const [mode, setMode] = useState<Mode>('manual')

  // Manual form
  const [name, setName] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
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

  // Scan
  const [image, setImage] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([])
  const [scanCategory, setScanCategory] = useState('продукты')
  const [scanComment, setScanComment] = useState('')
  const [scanDate, setScanDate] = useState(new Date().toISOString().slice(0, 10))
  const fileRef = useRef<HTMLInputElement>(null)
  const [showCamera, setShowCamera] = useState(false)

  const amount = (parseFloat(price) || 0) * (parseFloat(quantity) || 0)

  async function handleManualSave() {
    if (!name.trim() || !price) return
    setSaving(true)
    try {
      await api.createTransaction({
        name: name.trim(),
        date,
        price: parseFloat(price),
        quantity: parseFloat(quantity) || 1,
        amount,
        category,
        comment,
      })
      onSaved()
    } catch {
      alert('Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
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

  async function recognize() {
    if (!image) return
    setScanning(true)
    try {
      const { data } = await Tesseract.recognize(image, 'rus+eng', {})
      const items = parseReceipt(data.text)
      setScannedItems(items)
    } catch {
      alert('Ошибка распознавания')
    } finally {
      setScanning(false)
    }
  }

  function parseReceipt(text: string): ScannedItem[] {
    const lines = text.split('\n').filter((l) => l.trim())
    const results: ScannedItem[] = []
    for (const line of lines) {
      const match = line.match(/(.+?)\s+([\d.,]+)\s*[₽р]?\s*$/)
      if (match) {
        results.push({
          name: match[1].trim(),
          price: match[2].replace(',', '.'),
          selected: true,
        })
      }
    }
    return results
  }

  function toggleItem(i: number) {
    setScannedItems((prev) =>
      prev.map((item, idx) => idx === i ? { ...item, selected: !item.selected } : item)
    )
  }

  async function saveScanned() {
    const selected = scannedItems.filter((i) => i.selected)
    if (!selected.length) return
    setSaving(true)
    try {
      for (const item of selected) {
        const p = parseFloat(item.price) || 0
        await api.createTransaction({
          name: item.name,
          date: scanDate,
          price: p,
          quantity: 1,
          amount: p,
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
            <input
              className="input"
              placeholder="Название"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
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
            {amount > 0 && (
              <p className="text-sm font-semibold text-right">
                Сумма: {amount.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽
              </p>
            )}
            <div>
              <Select
                value={category}
                onChange={(v) => { setCategory(v); setAutoCategory(false) }}
                placeholder="Категория..."
                options={categories.map((c) => ({ value: c, label: c }))}
              />
              {autoCategory && category && (
                <p className="text-muted mt-1" style={{ color: 'var(--color-primary)' }}>
                  Автоподбор: {category}
                </p>
              )}
            </div>
            <input
              className="input"
              placeholder="Комментарий"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <button
              className="btn btn-primary w-full"
              disabled={!name.trim() || !price || saving}
              onClick={handleManualSave}
            >
              {saving ? 'Сохраняю...' : 'Сохранить'}
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
                onClose={() => setShowCamera(false)}
              />
            )}

            {image && scannedItems.length === 0 && (
              <>
                <div className="rounded-2xl overflow-hidden border border-[var(--color-border)]">
                  <img src={image} alt="Чек" className="w-full" />
                </div>
                <div className="flex gap-3">
                  <button className="btn btn-primary flex-1" onClick={recognize} disabled={scanning}>
                    {scanning ? 'Распознаю...' : 'Распознать'}
                  </button>
                  <button className="btn btn-secondary" onClick={() => setImage(null)}>
                    Заново
                  </button>
                </div>
              </>
            )}

            {scannedItems.length > 0 && (
              <>
                <p className="text-muted">{scannedItems.filter((i) => i.selected).length} из {scannedItems.length} выбрано</p>
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                  {scannedItems.map((item, i) => (
                    <div
                      key={i}
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
                      <span className="text-sm flex-1 truncate">{item.name}</span>
                      <span className="text-sm font-semibold tabular-nums">{item.price} ₽</span>
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
