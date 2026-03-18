import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './auth'
import Layout from './Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import ProductForm from './pages/ProductForm'
import Categories from './pages/Categories'
import Suppliers from './pages/Suppliers'
import Warehouse from './pages/Warehouse'
import Receipts from './pages/Receipts'
import Orders from './pages/Orders'
import Stock from './pages/Stock'
import Transfers from './pages/Transfers'
import Inventory from './pages/Inventory'
import Reports from './pages/Reports'
import Users from './pages/Users'

function PrivateRoute({ children }) {
  const { token } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={
        <PrivateRoute>
          <Layout />
        </PrivateRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="products/new" element={<ProductForm />} />
        <Route path="products/:id/edit" element={<ProductForm />} />
        <Route path="categories" element={<Categories />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="warehouse" element={<Warehouse />} />
        <Route path="receipts" element={<Receipts />} />
        <Route path="orders" element={<Orders />} />
        <Route path="stock" element={<Stock />} />
        <Route path="transfers" element={<Transfers />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="reports" element={<Reports />} />
        <Route path="users" element={<Users />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
