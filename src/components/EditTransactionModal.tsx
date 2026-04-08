import { useState } from 'react'
import { api, type Transaction } from '../api'
import Select from './Select'

interface Props {
  transaction: Transaction
  categories: string[]
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}

export default function EditTransactionModal({ transaction, categories, onClose, onSaved, onDeleted }: Props) {
  const [name, setName] = useState(transaction.name)
  const [date, setDate] = useState(transaction.date.slice(0, 10))
  const [price, setPrice] = useState(String(transaction.price))
  const [quantity, setQuantity] = useState(String(transaction.quantity))
  const [category, setCategory] = useState(transaction.category)
  const [comment, setComment] = useState(transaction.comment)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const amount = (parseFloat(price) || 0) * (parseFloat(quantity) || 0)

  async function handleSave() {
    if (!name.trim() || !price) return
    setSaving(true)
    try {
      await api.updateTransaction(transaction.id, {
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

  async function handleDelete() {
    setDeleting(true)
    try {
      await api.deleteTransaction(transaction.id)
      onDeleted()
    } catch {
      alert('Ошибка удаления')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Редактировать</span>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>

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
        <Select
          value={category}
          onChange={setCategory}
          placeholder="Категория..."
          options={categories.map((c) => ({ value: c, label: c }))}
        />
        <input
          className="input"
          placeholder="Комментарий"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />

        <button
          className="btn btn-primary w-full"
          disabled={!name.trim() || !price || saving}
          onClick={handleSave}
        >
          {saving ? 'Сохраняю...' : 'Сохранить'}
        </button>

        {!confirmDelete ? (
          <button
            className="btn btn-secondary w-full text-danger"
            onClick={() => setConfirmDelete(true)}
          >
            Удалить
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              className="btn btn-secondary flex-1"
              onClick={() => setConfirmDelete(false)}
            >
              Отмена
            </button>
            <button
              className="btn flex-1"
              style={{ background: 'var(--color-danger)', color: 'white', borderColor: 'var(--color-danger)' }}
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? 'Удаляю...' : 'Да, удалить'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
