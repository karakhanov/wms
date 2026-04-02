import { useState, useEffect } from 'react';
import styles from './Alert.module.css';

export const Alert = ({
  type = 'info', // 'info', 'success', 'warning', 'error'
  title,
  message,
  onClose,
  autoClose = false,
  duration = 5000,
  icon: Icon = null,
  action,
  children,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!autoClose) return;
    const timer = setTimeout(() => {
      setIsVisible(false);
      onClose?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [autoClose, duration, onClose]);

  if (!isVisible) return null;

  const typeClass = styles[`alert-${type}`] || styles['alert-info'];
  const classes = [styles.alert, typeClass, className]
    .filter(Boolean)
    .join(' ');

  const handleClose = () => {
    setIsVisible(false);
    onClose?.();
  };

  return (
    <div className={classes} role="alert">
      <div className={styles.content}>
        {Icon && <Icon className={styles.icon} />}
        <div className={styles.text}>
          {title && <div className={styles.title}>{title}</div>}
          {message && <div className={styles.message}>{message}</div>}
          {children && <div className={styles.children}>{children}</div>}
        </div>
      </div>
      <div className={styles.actions}>
        {action && (
          <button className={styles.actionButton} onClick={action.onClick}>
            {action.label}
          </button>
        )}
        <button
          className={styles.closeButton}
          onClick={handleClose}
          aria-label="Close alert"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default Alert;
