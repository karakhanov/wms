/** Единый размер иконок меню / UI, currentColor для наследования цвета */

function Svg({ children, className = '', size = 20, viewBox = '0 0 24 24' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {children}
    </svg>
  )
}

export function IconUser({ className, size = 18 }) {
  return (
    <Svg className={className} size={size}>
      <path
        d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function IconLogout({ className, size = 16 }) {
  return (
    <Svg className={className} size={size}>
      <path
        d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 16l4-4-4-4M14 12H4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/** Свернуть панель (влево) */
export function IconChevronLeft({ className, size = 18 }) {
  return (
    <Svg className={className} size={size}>
      <path
        d="M15 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/** Развернуть панель (вправо) */
export function IconChevronRight({ className, size = 18 }) {
  return (
    <Svg className={className} size={size}>
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/** Раскрыть блок (вниз) */
export function IconChevronDown({ className, size = 18 }) {
  return (
    <Svg className={className} size={size}>
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/** Пустой список / нет данных */
export function IconEmptyBox({ className, size = 48 }) {
  return (
    <Svg className={className} size={size} viewBox="0 0 24 24">
      <path
        d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/** Объект / здание — плейсхолдер фото на карточке объекта */
export function IconBuilding({ className, size = 64 }) {
  return (
    <Svg className={className} size={size} viewBox="0 0 24 24">
      <path
        d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4M9 13h2M13 13h2M9 9h2M13 9h2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 21v-5a1 1 0 011-1h2a1 1 0 011 1v5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

const NAV_PATHS = {
  dashboard: (
    <>
      <path
        d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-9z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </>
  ),
  products: (
    <>
      <path
        d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </>
  ),
  categories: (
    <>
      <path
        d="M4 6h7v7H4V6zM13 6h7v4h-7V6zM13 13h7v5h-7v-5zM4 15h7v3H4v-3z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </>
  ),
  warehouse: (
    <>
      <path
        d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  suppliers: (
    <>
      <path
        d="M14 18V6a2 2 0 00-2-2H4a2 2 0 00-2 2v12M14 18h6M14 12h4M14 8h2M2 18h12"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  receipts: (
    <>
      <path
        d="M12 3v12M8 11l4 4 4-4M5 21h14a2 2 0 002-2V7l-4-4H5a2 2 0 00-2 2v14a2 2 0 002 2z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  orders: (
    <>
      <path
        d="M16 3h5v5M4 12l16-9M21 3l-7 7M8 21H3v-5M21 3l-9 9-4 4-6 6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  stock: (
    <>
      <path d="M4 19V5M4 19h16M4 15h16M8 5v14M12 9v10M16 7v12M20 11v8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </>
  ),
  transfers: (
    <>
      <path
        d="M7 16V4M7 4L3 8M7 4l4 4M17 8v12M17 20l4-4M17 20l-4-4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  inventory: (
    <>
      <path
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9h6m-6 4h6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  reports: (
    <>
      <path d="M4 19V5M8 19V11M12 19V8M16 19v-5M20 19V9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M4 19h16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </>
  ),
  users: (
    <>
      <path
        d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  notifications: (
    <>
      <path
        d="M15 17h5l-1.5-2v-4a6.5 6.5 0 10-13 0v4L4 17h5m1 0a2 2 0 004 0h-4z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
}

/**
 * @param {{ name: keyof typeof NAV_PATHS, className?: string, size?: number }} props
 */
export function IconNav({ name, className = '', size = 20 }) {
  const content = NAV_PATHS[name] || NAV_PATHS.dashboard
  return (
    <Svg className={className} size={size}>
      {content}
    </Svg>
  )
}
