import { useTranslation } from 'react-i18next'
import panelStyles from '../pages/DataPanelLayout.module.css'

/**
 * Списочная страница: одна карточка — строка заголовка + фильтры, разделитель, контент (таблица).
 * @param {{
 *   title: import('react').ReactNode,
 *   leadExtra?: import('react').ReactNode,
 *   search?: import('react').ReactNode,
 *   filters: import('react').ReactNode,
 *   exportButton?: import('react').ReactNode,
 *   loading?: boolean,
 *   children: import('react').ReactNode,
 *   flushTop?: boolean,
 *   titleTag?: 'h1' | 'h2' | 'h3',
 * }} props
 */
export default function ListPageDataPanel({
  title,
  leadExtra,
  search,
  filters,
  exportButton,
  loading,
  children,
  flushTop,
  titleTag = 'h1',
}) {
  const { t } = useTranslation()
  const sectionClass = flushTop
    ? `${panelStyles.dataPanelSection} ${panelStyles.dataPanelSectionFlushTop}`
    : panelStyles.dataPanelSection
  const TitleTag = titleTag

  return (
    <section className={sectionClass}>
      <div className={panelStyles.dataPanelCard}>
        <div className={panelStyles.dataPanelToolbar}>
          <div className={panelStyles.filterToolbar}>
            <div className={`${panelStyles.filterToolbarLead} ${panelStyles.filterToolbarLeadRow}`}>
              <TitleTag className={panelStyles.filterToolbarHeadline}>{title}</TitleTag>
            </div>
            {search ? <div className={panelStyles.filterToolbarSearch}>{search}</div> : null}
            <div className={panelStyles.filterToolbarActions}>
              {filters}
              {exportButton}
              {leadExtra ? <div className={panelStyles.filterToolbarLeadExtra}>{leadExtra}</div> : null}
            </div>
          </div>
        </div>
        <div className={panelStyles.dataPanelDivider} aria-hidden />
        <div className={panelStyles.dataPanelBody}>
          {loading ? <div className={panelStyles.dataPanelBlockLoading}>{t('common.loading')}</div> : children}
        </div>
      </div>
    </section>
  )
}
