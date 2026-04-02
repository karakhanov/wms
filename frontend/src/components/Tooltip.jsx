import { useState } from 'react';
import styles from './Tooltip.module.css';

export const Tooltip = ({
  content,
  children,
  position = 'top',
  delay = 200,
  theme = 'dark',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState(null);

  const handleMouseEnter = () => {
    const id = setTimeout(() => {
      setIsVisible(true);
    }, delay);
    setTimeoutId(id);
  };

  const handleMouseLeave = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    setIsVisible(false);
  };

  const positionClass = styles[`position-${position}`] || styles['position-top'];
  const themeClass = styles[`theme-${theme}`] || styles['theme-dark'];

  return (
    <div
      className={styles.tooltipWrapper}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {isVisible && content && (
        <div className={[styles.tooltip, positionClass, themeClass].join(' ')}>
          <div className={styles.tooltipContent}>{content}</div>
          <div className={styles.tooltipArrow} />
        </div>
      )}
    </div>
  );
};

export default Tooltip;
