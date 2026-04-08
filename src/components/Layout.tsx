import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import logo from '../assets/casheleklogo.png'

// Analytics — bar chart with pulse dot
const IconAnalytics = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="12" width="4" height="9" rx="1" />
    <rect x="10" y="7" width="4" height="14" rx="1" />
    <rect x="17" y="3" width="4" height="18" rx="1" />
    <circle cx="19" cy="3" r="2" fill="var(--color-primary)" stroke="none" />
  </svg>
)

// Expenses — wallet with arrow out
const IconExpenses = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="14" rx="3" />
    <path d="M2 10h20" />
    <circle cx="17" cy="15" r="1.5" fill="var(--color-danger)" stroke="none" />
    <path d="M6 6V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
  </svg>
)

// Income — arrow trending up with spark
const IconIncome = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 17 9 11 13 15 21 7" />
    <polyline points="15 7 21 7 21 13" />
    <line x1="18" y1="3" x2="18" y2="5" stroke="var(--color-primary)" strokeWidth="2" />
    <line x1="16.5" y1="4.5" x2="19.5" y2="4.5" stroke="var(--color-primary)" strokeWidth="2" />
  </svg>
)

// Groceries — bag with checkmark
const IconGrocery = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2l-2 5v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7l-2-5H6z" />
    <path d="M4 7h16" />
    <path d="M9 10a3 3 0 0 0 6 0" />
    <polyline points="9.5 15 11 16.5 14.5 13" stroke="var(--color-primary)" strokeWidth="2" />
  </svg>
)

const navItems = [
  { to: '/', label: 'Аналитика', icon: IconAnalytics },
  { to: '/transactions', label: 'Траты', icon: IconExpenses },
  { to: '/income', label: 'Доходы', icon: IconIncome },
  { to: '/grocery', label: 'Покупки', icon: IconGrocery },
]

const pageTitles: Record<string, string> = {
  '/': 'Аналитика',
  '/transactions': 'Траты',
  '/income': 'Доходы',
  '/grocery': 'Покупки',
}

export default function Layout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const title = pageTitles[location.pathname] || 'Finance'

  return (
    <div className="flex flex-col h-dvh">
      <header className="header shrink-0">
        <div className="header-top">
          <div className="header-user">
            <img src={logo} alt="Cashelek" className="header-logo" />
          </div>
          <div className="header-right">
            <span className="header-greeting">{user?.email?.split('@')[0] || 'User'}</span>
            <button onClick={logout} className="header-logout" aria-label="Выйти">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
          </div>
        </div>
        <h1 className="header-title">{title}</h1>
      </header>

      <main className="flex-1 overflow-y-auto" style={{ paddingBottom: 200 }}>
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-[var(--color-surface)] border-t border-[var(--color-border)] flex safe-area-bottom" style={{ paddingBlock: 10 }}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-3 text-xs font-medium transition-colors ${
                isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'
              }`
            }
          >
            <span className="mb-1"><item.icon /></span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
