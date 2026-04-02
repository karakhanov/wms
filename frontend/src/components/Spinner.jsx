import styles from './Spinner.module.css';

export const Spinner = ({ size = 'md', className = '' }) => {
  const sizeClass = styles[`spinner-${size}`] || styles['spinner-md'];
  const classes = [styles.spinner, sizeClass, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <div className={styles.ring} />
      <div className={styles.dot} />
    </div>
  );
};

export const SpinnerOverlay = ({ isVisible = false, text = 'Loading...' }) => {
  if (!isVisible) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.overlayContent}>
        <Spinner size="lg" />
        {text && <div className={styles.overlayText}>{text}</div>}
      </div>
    </div>
  );
};

export default Spinner;
