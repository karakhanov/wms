import { useState } from 'react';
import styles from './Input.module.css';

export const Input = ({
  type = 'text',
  label,
  error,
  hint,
  icon: Icon = null,
  iconPosition = 'left',
  required = false,
  disabled = false,
  className = '',
  value,
  onChange,
  onFocus,
  onBlur,
  placeholder,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const inputClasses = [
    styles.input,
    error && styles.inputError,
    Icon && styles[`input-${iconPosition}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const wrapperClasses = [styles.wrapper, isFocused && styles.focused]
    .filter(Boolean)
    .join(' ');

  const handleFocus = (e) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  return (
    <div className={styles.inputGroup}>
      {label && (
        <label className={styles.label}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
      )}
      <div className={wrapperClasses}>
        {Icon && iconPosition === 'left' && (
          <Icon className={styles.iconLeft} />
        )}
        <input
          type={type}
          value={value}
          onChange={onChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={placeholder}
          className={inputClasses}
          {...props}
        />
        {Icon && iconPosition === 'right' && (
          <Icon className={styles.iconRight} />
        )}
      </div>
      {error && <div className={styles.error}>{error}</div>}
      {hint && !error && <div className={styles.hint}>{hint}</div>}
    </div>
  );
};

export const Textarea = ({
  label,
  error,
  hint,
  required = false,
  disabled = false,
  className = '',
  rows = 4,
  value,
  onChange,
  onFocus,
  onBlur,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const textareaClasses = [
    styles.textarea,
    error && styles.inputError,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const wrapperClasses = [styles.wrapper, isFocused && styles.focused]
    .filter(Boolean)
    .join(' ');

  const handleFocus = (e) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  return (
    <div className={styles.inputGroup}>
      {label && (
        <label className={styles.label}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
      )}
      <div className={wrapperClasses}>
        <textarea
          rows={rows}
          value={value}
          onChange={onChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          className={textareaClasses}
          {...props}
        />
      </div>
      {error && <div className={styles.error}>{error}</div>}
      {hint && !error && <div className={styles.hint}>{hint}</div>}
    </div>
  );
};

export const Select = ({
  label,
  error,
  hint,
  required = false,
  disabled = false,
  options = [],
  className = '',
  value,
  onChange,
  placeholder = 'Select...',
  ...props
}) => {
  const selectClasses = [
    styles.select,
    error && styles.inputError,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.inputGroup}>
      {label && (
        <label className={styles.label}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
      )}
      <div className={styles.wrapper}>
        <select
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={selectClasses}
          {...props}
        >
          <option value="">{placeholder}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      {error && <div className={styles.error}>{error}</div>}
      {hint && !error && <div className={styles.hint}>{hint}</div>}
    </div>
  );
};

export default Input;
