import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth'
import { auth as authApi } from '../api'
import { BRAND_LOGO_URL } from '../siteConfig'
import ThemeToggle from '../ThemeToggle'
import LanguageSelect from '../components/LanguageSelect'
import styles from './Login.module.css'

export default function Login() {
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { setToken } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const data = await authApi.login(username, password)
      setToken(data.access)
      const me = await authApi.me()
      setToken(data.access, me)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || t('login.error'))
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.langWrap}>
        <LanguageSelect />
        <ThemeToggle />
      </div>
      <div className={styles.card}>
        <img src={BRAND_LOGO_URL} alt={t('app.title')} className={styles.brandLogo} decoding="async" />
        <h1 className={styles.title}>{t('login.title')}</h1>
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            type="text"
            placeholder={t('login.username')}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={styles.input}
            autoComplete="username"
            required
          />
          <input
            type="password"
            placeholder={t('login.password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={styles.input}
            autoComplete="current-password"
            required
          />
          {error && <div className={styles.error}>{error}</div>}
          <button type="submit" className={styles.button}>{t('login.submit')}</button>
        </form>
      </div>
    </div>
  )
}
