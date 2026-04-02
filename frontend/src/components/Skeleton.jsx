import styles from './Skeleton.module.css';

export const Skeleton = ({
  width = '100%',
  height = '1em',
  circle = false,
  className = '',
}) => {
  const classes = [
    styles.skeleton,
    circle && styles.circle,
    className,
  ].filter(Boolean).join(' ');

  return (
    <div
      className={classes}
      style={{
        width,
        height,
        borderRadius: circle ? '50%' : 'var(--radius-sm)',
      }}
    />
  );
};

export const SkeletonText = ({ lines = 3, className = '' }) => {
  return (
    <div className={[styles.skeletonText, className].filter(Boolean).join(' ')}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? '70%' : '100%'}
          height="1em"
        />
      ))}
    </div>
  );
};

export const SkeletonTableRow = ({ columns = 5, className = '' }) => {
  return (
    <div className={[styles.skeletonRow, className].filter(Boolean).join(' ')}>
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} width="100%" height="24px" />
      ))}
    </div>
  );
};

export const SkeletonCard = ({ className = '' }) => {
  return (
    <div className={[styles.skeletonCard, className].filter(Boolean).join(' ')}>
      <Skeleton width="100%" height="160px" />
      <div style={{ padding: '16px' }}>
        <Skeleton width="60%" height="1.2em" style={{ marginBottom: '8px' }} />
        <SkeletonText lines={2} />
      </div>
    </div>
  );
};

export default Skeleton;
