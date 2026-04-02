import { createContext, useContext, useState, useCallback } from 'react';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const addNotification = useCallback(
    (message, options = {}) => {
      const id = Date.now();
      const notification = {
        id,
        message,
        type: options.type || 'info', // 'info', 'success', 'warning', 'error'
        title: options.title,
        autoClose: options.autoClose !== false,
        duration: options.duration || 5000,
        action: options.action,
      };

      setNotifications((prev) => [...prev, notification]);

      if (notification.autoClose) {
        setTimeout(() => {
          removeNotification(id);
        }, notification.duration);
      }

      return id;
    },
    []
  );

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((notif) => notif.id !== id));
  }, []);

  const success = useCallback(
    (message, options = {}) =>
      addNotification(message, { ...options, type: 'success' }),
    [addNotification]
  );

  const error = useCallback(
    (message, options = {}) =>
      addNotification(message, { ...options, type: 'error' }),
    [addNotification]
  );

  const warning = useCallback(
    (message, options = {}) =>
      addNotification(message, { ...options, type: 'warning' }),
    [addNotification]
  );

  const info = useCallback(
    (message, options = {}) =>
      addNotification(message, { ...options, type: 'info' }),
    [addNotification]
  );

  const value = {
    notifications,
    addNotification,
    removeNotification,
    success,
    error,
    warning,
    info,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

export default useNotifications;
