import styles from './Card.module.css';

export const Card = ({
  children,
  header,
  footer,
  interactive = false,
  onClick,
  className = '',
  borderColor = null,
  ...props
}) => {
  const classes = [
    styles.card,
    interactive && styles.interactive,
    borderColor && styles[`border-${borderColor}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} onClick={onClick} {...props}>
      {header && <div className={styles.header}>{header}</div>}
      <div className={styles.content}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
};

export const CardGrid = ({ children, columns = 3, className = '' }) => {
  const classes = [
    styles.cardGrid,
    styles[`columns-${columns}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <div className={classes}>{children}</div>;
};

export default Card;
