import styles from './Progress.module.css';

export const Progress = ({
  value = 0,
  max = 100,
  size = 'md',
  variant = 'primary',
  animated = false,
  label,
  showPercent = false,
  className = '',
}) => {
  const percent = Math.min(Math.max((value / max) * 100, 0), 100);
  const variantClass = styles[`variant-${variant}`] || styles['variant-primary'];
  const sizeClass = styles[`size-${size}`] || styles['size-md'];

  const classes = [
    styles.progress,
    variantClass,
    sizeClass,
    animated && styles.animated,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      {label && <div className={styles.label}>{label}</div>}
      <div className={styles.track}>
        <div
          className={styles.bar}
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
      {showPercent && <div className={styles.percent}>{Math.round(percent)}%</div>}
    </div>
  );
};

export const Divider = ({ text = '', className = '' }) => {
  const classes = [styles.divider, text && styles.withText, className]
    .filter(Boolean)
    .join(' ');

  return text ? (
    <div className={classes}>
      <span className={styles.dividerText}>{text}</span>
    </div>
  ) : (
    <div className={classes} />
  );
};

export default Progress;
