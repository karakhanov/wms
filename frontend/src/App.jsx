import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './auth'
import Layout from './Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import ProductDetailsPage from './pages/ProductDetailsPage'
import Categories from './pages/Categories'
import Suppliers from './pages/Suppliers'
import Services from './pages/Services'
import Warehouse from './pages/Warehouse'
import Receipts from './pages/Receipts'
import Orders from './pages/Orders'
import Stock from './pages/Stock'
import Transfers from './pages/Transfers'
import Inventory from './pages/Inventory'
import Reports from './pages/Reports'
import Users from './pages/Users'
import RolesAccess from './pages/RolesAccess'
import IssueNotes from './pages/IssueNotes'
import ConstructionObjects from './pages/ConstructionObjects'
import Notifications from './pages/Notifications'
import History from './pages/History'
import ObjectLimitsDashboard from './pages/ObjectLimitsDashboard'
import ObjectTypes from './pages/ObjectTypes'
import ConstructionObjectDetails from './pages/ConstructionObjectDetails'
import ObjectTypeDetails from './pages/ObjectTypeDetails'
import ObjectTypeEditor from './pages/ObjectTypeEditor'
import ConstructionObjectEditor from './pages/ConstructionObjectEditor'
import About from './pages/About'
import Profile from './pages/Profile'

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
        <Route path="dashboard" element={<Navigate to="/" replace />} />
        <Route path="products" element={<Products />} />
        <Route path="products/new" element={<Navigate to="/products" replace />} />
        <Route path="products/:id/edit" element={<Navigate to="/products" replace />} />
        <Route path="products/:id" element={<ProductDetailsPage />} />
        <Route path="products/:id/stock" element={<ProductDetailsPage />} />
        <Route path="products/:id/docs" element={<ProductDetailsPage />} />
        <Route path="products/:id/ops" element={<ProductDetailsPage />} />
        <Route path="categories" element={<Categories />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="services" element={<Services />} />
        <Route path="warehouse" element={<Warehouse />} />
        <Route path="objects" element={<ConstructionObjects />} />
        <Route path="objects/new" element={<ConstructionObjectEditor />} />
        <Route path="objects/:id/edit" element={<ConstructionObjectEditor />} />
        <Route path="objects/:id" element={<ConstructionObjectDetails />} />
        <Route path="receipts" element={<Receipts />} />
        <Route path="orders" element={<Orders />} />
        <Route path="issue-notes" element={<IssueNotes />} />
        <Route path="stock" element={<Stock />} />
        <Route path="transfers" element={<Transfers />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="reports" element={<Reports />} />
        <Route path="users" element={<Users />} />
        <Route path="roles-access" element={<RolesAccess />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="history" element={<History />} />
        <Route path="object-limits" element={<ObjectLimitsDashboard />} />
        <Route path="object-types" element={<ObjectTypes />} />
        <Route path="object-types/new" element={<ObjectTypeEditor />} />
        <Route path="object-types/:id/edit" element={<ObjectTypeEditor />} />
        <Route path="object-types/:id" element={<ObjectTypeDetails />} />
        <Route path="about" element={<About />} />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
