import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import AnalyticsPage from './pages/AnalyticsPage'
import TransactionsPage from './pages/TransactionsPage'
import IncomePage from './pages/IncomePage'
import GroceryPage from './pages/GroceryPage'
import ReceiptPage from './pages/ReceiptPage'

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<AnalyticsPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/income" element={<IncomePage />} />
            <Route path="/grocery" element={<GroceryPage />} />
            <Route path="/receipt" element={<ReceiptPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
