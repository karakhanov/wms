/**
 * Иллюстрации для EmptyState
 * 2-цветные flat vector: teal #1B6B4A + light accent
 */

// Приём товара — грузовик и коробка
export function IllustrationReceipt() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Грузовик */}
      <rect x="20" y="60" width="50" height="35" rx="4" fill="#1B6B4A" opacity="0.3" />
      <rect x="25" y="65" width="40" height="25" rx="3" fill="#1B6B4A" />
      <circle cx="35" cy="95" r="5" fill="#1B6B4A" opacity="0.6" />
      <circle cx="55" cy="95" r="5" fill="#1B6B4A" opacity="0.6" />
      
      {/* Кабина */}
      <rect x="65" y="70" width="12" height="15" rx="2" fill="#1B6B4A" opacity="0.5" />
      <rect x="66" y="71" width="4" height="4" fill="#3B82F6" />
      
      {/* Коробки на конвейере */}
      <rect x="30" y="40" width="12" height="12" fill="#3B82F6" />
      <rect x="48" y="38" width="12" height="12" fill="#1B6B4A" opacity="0.4" />
      <rect x="66" y="42" width="12" height="12" fill="#3B82F6" opacity="0.6" />
      
      {/* Конвейер */}
      <line x1="25" y1="52" x2="75" y2="52" stroke="#1B6B4A" strokeWidth="2" opacity="0.3" />
    </svg>
  )
}

// Успех — зелёная галочка
export function IllustrationSuccess() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Окружность */}
      <circle cx="60" cy="60" r="45" fill="#1B6B4A" opacity="0.15" />
      <circle cx="60" cy="60" r="35" fill="#1B6B4A" opacity="0.25" />
      
      {/* Галочка */}
      <path
        d="M45 60L55 70L80 45"
        stroke="#1B6B4A"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

// Заказы — буфер/список заказов
export function IllustrationOrders() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Доска/буфер */}
      <rect x="30" y="20" width="60" height="75" rx="4" fill="#1B6B4A" opacity="0.15" />
      <rect x="32" y="22" width="56" height="71" rx="3" fill="#3B82F6" opacity="0.3" stroke="#1B6B4A" strokeWidth="2" />
      
      {/* Зажим сверху */}
      <rect x="50" y="15" width="20" height="8" rx="2" fill="#1B6B4A" />
      <circle cx="58" cy="19" r="1.5" fill="#fff" opacity="0.5" />
      <circle cx="62" cy="19" r="1.5" fill="#fff" opacity="0.5" />
      
      {/* Строки в списке */}
      <line x1="40" y1="38" x2="80" y2="38" stroke="#1B6B4A" strokeWidth="2" opacity="0.6" />
      <line x1="40" y1="50" x2="80" y2="50" stroke="#1B6B4A" strokeWidth="2" opacity="0.4" />
      <line x1="40" y1="62" x2="75" y2="62" stroke="#1B6B4A" strokeWidth="2" opacity="0.3" />
    </svg>
  )
}

// Общая иллюстрация для других случаев
export function IllustrationGeneric() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="35" y="35" width="50" height="50" rx="6" fill="#1B6B4A" opacity="0.15" />
      <path d="M60 45L70 60L60 75L50 60Z" fill="#3B82F6" opacity="0.6" />
      <circle cx="60" cy="60" r="8" fill="#1B6B4A" opacity="0.3" />
    </svg>
  )
}
