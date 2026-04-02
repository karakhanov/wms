import styles from './Button.module.css';

/**
 * Universal Button component with multiple variants
 * Variants: primary, secondary, danger, ghost, outline
 * Sizes: sm, md, lg
 * States: disabled, loading
 */
export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon: Icon = null,
  iconPosition = 'left',
  className = '',
  type = 'button',
  ...props
}) => {
  const variantClass = styles[`variant-${variant}`] || styles['variant-primary'];
  const sizeClass = styles[`size-${size}`] || styles['size-md'];
  const classes = [
    styles.button,
    variantClass,
    sizeClass,
    disabled && styles.disabled,
    loading && styles.loading,
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <span className={styles.spinner} />
          <span className={styles.buttonText}>{children}</span>
        </>
      ) : (
        <>
          {Icon && iconPosition === 'left' && (
            <Icon className={styles.icon} />
          )}
          <span className={styles.buttonText}>{children}</span>
          {Icon && iconPosition === 'right' && (
            <Icon className={styles.icon} />
          )}
        </>
      )}
    </button>
  );
};

export default Button;
