import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface GroceryItem {
  id: string
  name: string
  done: boolean
}

export default function GroceryPage() {
  const [items, setItems] = useState<GroceryItem[]>(() => {
    const saved = localStorage.getItem('grocery-list')
    return saved ? JSON.parse(saved) : []
  })
  const [name, setName] = useState('')

  function save(updated: GroceryItem[]) {
    setItems(updated)
    localStorage.setItem('grocery-list', JSON.stringify(updated))
  }

  function addItem() {
    if (!name.trim()) return
    save([{ id: crypto.randomUUID(), name: name.trim(), done: false }, ...items])
    setName('')
  }

  function toggleItem(id: string) {
    save(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)))
  }

  function removeItem(id: string) {
    save(items.filter((i) => i.id !== id))
  }

  function clearDone() {
    save(items.filter((i) => !i.done))
  }

  const doneCount = items.filter((i) => i.done).length
  const pending = items.filter((i) => !i.done)
  const done = items.filter((i) => i.done)

  return (
    <div className="page">
      <form
        onSubmit={(e) => { e.preventDefault(); addItem() }}
        className="flex gap-3"
      >
        <input
          type="text"
          placeholder="Продукт..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
        />
        <button type="submit" className="btn btn-primary">+</button>
      </form>

      {items.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-muted">{doneCount}/{items.length} куплено</p>
          {doneCount > 0 && (
            <button onClick={clearDone} className="text-danger text-xs hover:underline">
              Очистить купленные
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <AnimatePresence mode="popLayout">
          {pending.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              className="card-compact flex items-center gap-4"
            >
              <button
                onClick={() => toggleItem(item.id)}
                className="w-6 h-6 rounded-full border-2 border-[var(--color-border)] shrink-0 transition-colors hover:border-[var(--color-primary)]"
              />
              <p className="text-sm flex-1">{item.name}</p>
              <button
                onClick={() => removeItem(item.id)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-danger)] text-lg leading-none transition-colors"
              >
                x
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {done.length > 0 && (
        <>
          <p className="text-muted pt-2 px-1">Куплено</p>
          <div className="flex flex-col gap-2">
            <AnimatePresence mode="popLayout">
              {done.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.5 }}
                  exit={{ opacity: 0, x: -100 }}
                  className="card-compact flex items-center gap-4"
                >
                  <button
                    onClick={() => toggleItem(item.id)}
                    className="w-6 h-6 rounded-full border-2 border-[var(--color-success)] bg-[var(--color-success)]/20 shrink-0 flex items-center justify-center"
                  >
                    <span className="text-[var(--color-success)] text-xs">&#10003;</span>
                  </button>
                  <p className="text-sm line-through flex-1">{item.name}</p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}

      {items.length === 0 && (
        <div className="text-center py-16">
          <p className="text-muted text-sm">Список пуст</p>
          <p className="text-muted mt-1">Добавьте продукты выше</p>
        </div>
      )}
    </div>
  )
}
