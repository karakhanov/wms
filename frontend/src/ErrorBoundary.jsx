import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('WMS UI error:', error, info)
  }

  render() {
    if (this.state.error) {
      const msg = this.state.error?.message || String(this.state.error)
      return (
        <div
          style={{
            padding: '2rem',
            fontFamily: 'system-ui, sans-serif',
            maxWidth: '640px',
            margin: '0 auto',
            lineHeight: 1.5,
          }}
        >
          <h1 style={{ color: '#b00020' }}>Ошибка интерфейса</h1>
          <pre
            style={{
              background: '#f5f5f5',
              padding: '1rem',
              overflow: 'auto',
              fontSize: '0.9rem',
            }}
          >
            {msg}
          </pre>
          <p>Откройте консоль браузера (F12 → Console) и обновите страницу.</p>
        </div>
      )
    }
    return this.props.children
  }
}
