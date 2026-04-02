import styles from './Pagination.module.css';

export const Pagination = ({
  currentPage = 1,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
  showItemsInfo = true,
  variant = 'default', // 'default', 'minimal'
  className = '',
}) => {
  const pages = [];
  const maxVisible = 7;
  const startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  const endPage = Math.min(totalPages, startPage + maxVisible - 1);

  // Adjust start if we're near the end
  const adjustedStart = Math.max(1, endPage - maxVisible + 1);

  if (adjustedStart > 1) {
    pages.push(1);
    if (adjustedStart > 2) pages.push('...');
  }

  for (let i = adjustedStart; i <= endPage; i++) {
    pages.push(i);
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) pages.push('...');
    pages.push(totalPages);
  }

  const handlePrevious = () => {
    if (currentPage > 1) onPageChange(currentPage - 1);
  };

  const handleNext = () => {
    if (currentPage < totalPages) onPageChange(currentPage + 1);
  };

  const classes = [
    styles.pagination,
    styles[`variant-${variant}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <div className={styles.controls}>
        <button
          className={styles.navBtn}
          onClick={handlePrevious}
          disabled={currentPage === 1}
          aria-label="Previous page"
        >
          ← Prev
        </button>

        <div className={styles.pagesList}>
          {pages.map((page, idx) => (
            <div key={idx}>
              {page === '...' ? (
                <span className={styles.ellipsis}>…</span>
              ) : (
                <button
                  className={[
                    styles.pageBtn,
                    page === currentPage && styles.active,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => onPageChange(page)}
                  aria-current={page === currentPage ? 'page' : undefined}
                  aria-label={`Page ${page}`}
                >
                  {page}
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          className={styles.navBtn}
          onClick={handleNext}
          disabled={currentPage === totalPages}
          aria-label="Next page"
        >
          Next →
        </button>
      </div>

      {showItemsInfo && totalItems && (
        <div className={styles.info}>
          Showing {(currentPage - 1) * itemsPerPage + 1}-
          {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}
        </div>
      )}
    </div>
  );
};

export default Pagination;
