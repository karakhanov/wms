import styles from './Badge.module.css';

/**
 * Badge - small label component for tags, statuses, counts
 * Variants: primary, secondary, success, warning, danger
 * Sizes: sm, md, lg (default md)
 */
export const Badge = ({
  children,
  variant = 'secondary',
  size = 'md',
  icon: Icon = null,
  className = '',
  dismissible = false,
  onDismiss,
  ...props
}) => {
  const variantClass = styles[`variant-${variant}`] || styles['variant-secondary'];
  const sizeClass = styles[`size-${size}`] || styles['size-md'];
  const classes = [
    styles.badge,
    variantClass,
    sizeClass,
    dismissible && styles.dismissible,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} {...props}>
      {Icon && <Icon className={styles.icon} />}
      <span className={styles.text}>{children}</span>
      {dismissible && (
        <button
          className={styles.dismissBtn}
          onClick={onDismiss}
          aria-label="Remove badge"
        >
          ✕
        </button>
      )}
    </span>
  );
};

/**
 * Chip - interactive badge with click support
 */
export const Chip = ({
  children,
  variant = 'secondary',
  size = 'md',
  icon: Icon = null,
  avatar,
  className = '',
  onClick,
  disabled = false,
  selected = false,
  ...props
}) => {
  const variantClass = styles[`variant-${variant}`] || styles['variant-secondary'];
  const sizeClass = styles[`size-${size}`] || styles['size-md'];
  const classes = [
    styles.chip,
    variantClass,
    sizeClass,
    selected && styles.selected,
    disabled && styles.disabled,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      className={classes}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {avatar && <img src={avatar} alt="" className={styles.avatar} />}
      {Icon && <Icon className={styles.icon} />}
      <span className={styles.text}>{children}</span>
    </button>
  );
};

export default Badge;
