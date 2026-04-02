import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { warehouse as warehouseApi } from '../api'
import { useAuth } from '../auth'
import { canManageWarehouse } from '../permissions'
import QuickWarehouseModal from '../components/QuickWarehouseModal'
import QuickZoneModal from '../components/QuickZoneModal'
import ListPageDataPanel from '../components/ListPageDataPanel'
import SortHeader from '../components/SortHeader'
import PaginationBar from '../components/PaginationBar'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { downloadCsv } from '../utils/csvExport'
import { normalizeListResponse, totalPages } from '../utils/listResponse'
import { DEFAULT_PAGE_SIZE } from '../constants/pagination'
import toolbarStyles from '../components/TableToolbar.module.css'
import { ToolbarSearchInput, ToolbarFilterSelect } from '../components/ToolbarControls'
import panelStyles from './DataPanelLayout.module.css'
import styles from './Table.module.css'
export default function Warehouse() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const canManage = canManageWarehouse(user)

  const [whData, setWhData] = useState({ results: [], count: 0 })
  const [zoneData, setZoneData] = useState({ results: [], count: 0 })
  const [whListForFilter, setWhListForFilter] = useState([])
  const [loadingWh, setLoadingWh] = useState(true)
  const [loadingZn, setLoadingZn] = useState(true)

  const [whPage, setWhPage] = useState(1)
  const [whPageSize, setWhPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [whSearch, setWhSearch] = useState('')
  const debouncedWhSearch = useDebouncedValue(whSearch, 400)

  const [zonePage, setZonePage] = useState(1)
  const [zonePageSize, setZonePageSize] = useState(DEFAULT_PAGE_SIZE)
  const [zoneSearch, setZoneSearch] = useState('')
  const debouncedZoneSearch = useDebouncedValue(zoneSearch, 400)
  const [zoneWarehouse, setZoneWarehouse] = useState('')

  const [quickWhOpen, setQuickWhOpen] = useState(false)
  const [quickZoneOpen, setQuickZoneOpen] = useState(false)
  const [defaultWarehouseForZone, setDefaultWarehouseForZone] = useState('')
  const [whSort, setWhSort] = useState({ key: 'name', dir: 'asc' })
  const [zoneSort, setZoneSort] = useState({ key: 'name', dir: 'asc' })

  const refreshWhNames = useCallback(() => {
    warehouseApi
      .warehouses({ page_size: 500 })
      .then((d) => setWhListForFilter(d.results || d || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    refreshWhNames()
  }, [refreshWhNames])

  useEffect(() => {
    let alive = true
    setLoadingWh(true)
    warehouseApi
      .warehouses({
        page: whPage,
        page_size: whPageSize,
        search: debouncedWhSearch.trim() || undefined,
      })
      .then((wh) => {
        if (alive) setWhData(normalizeListResponse(wh))
      })
      .catch(() => {
        if (alive) setWhData({ results: [], count: 0 })
      })
      .finally(() => {
        if (alive) setLoadingWh(false)
      })
    return () => {
      alive = false
    }
  }, [whPage, whPageSize, debouncedWhSearch])

  useEffect(() => {
    let alive = true
    setLoadingZn(true)
    warehouseApi
      .zones({
        page: zonePage,
        page_size: zonePageSize,
        search: debouncedZoneSearch.trim() || undefined,
        warehouse: zoneWarehouse || undefined,
      })
      .then((z) => {
        if (alive) setZoneData(normalizeListResponse(z))
      })
      .catch(() => {
        if (alive) setZoneData({ results: [], count: 0 })
      })
      .finally(() => {
        if (alive) setLoadingZn(false)
      })
    return () => {
      alive = false
    }
  }, [zonePage, zonePageSize, debouncedZoneSearch, zoneWarehouse])

  const reloadAfterModal = () => {
    refreshWhNames()
    setWhPage(1)
    setZonePage(1)
  }

  const openZoneModal = (warehouseId = '') => {
    setDefaultWarehouseForZone(warehouseId === '' || warehouseId == null ? '' : String(warehouseId))
    setQuickZoneOpen(true)
  }

  const warehouses = whData.results || []
  const sortedWarehouses = useMemo(() => {
    const arr = [...warehouses]
    const factor = whSort.dir === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      const av = whSort.key === 'address' ? String(a.address || '') : String(a.name || '')
      const bv = whSort.key === 'address' ? String(b.address || '') : String(b.name || '')
      return av.localeCompare(bv, 'ru') * factor
    })
    return arr
  }, [warehouses, whSort])
  const whCount = whData.count ?? warehouses.length
  const whPages = totalPages(whCount, whPageSize)

  const zones = zoneData.results || []
  const sortedZones = useMemo(() => {
    const arr = [...zones]
    const factor = zoneSort.dir === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      const av = zoneSort.key === 'code' ? String(a.code || '') : zoneSort.key === 'warehouse' ? String(a.warehouse_name || '') : String(a.name || '')
      const bv = zoneSort.key === 'code' ? String(b.code || '') : zoneSort.key === 'warehouse' ? String(b.warehouse_name || '') : String(b.name || '')
      return av.localeCompare(bv, 'ru') * factor
    })
    return arr
  }, [zones, zoneSort])
  const zoneCount = zoneData.count ?? zones.length
  const zonePages = totalPages(zoneCount, zonePageSize)

  const exportWarehouses = async () => {
    try {
      const data = await warehouseApi.warehouses({
        page_size: 500,
        search: debouncedWhSearch.trim() || undefined,
      })
      const { results } = normalizeListResponse(data)
      downloadCsv(
        `warehouses_${new Date().toISOString().slice(0, 10)}`,
        [t('warehouse.nameCol'), t('warehouse.address')],
        results.map((w) => [w.name, w.address || ''])
      )
    } catch {
      /* empty */
    }
  }

  const exportZones = async () => {
    try {
      const data = await warehouseApi.zones({
        page_size: 500,
        search: debouncedZoneSearch.trim() || undefined,
        warehouse: zoneWarehouse || undefined,
      })
      const { results } = normalizeListResponse(data)
      downloadCsv(
        `zones_${new Date().toISOString().slice(0, 10)}`,
        [t('warehouse.zoneName'), t('warehouse.zoneCode'), t('warehouse.wh')],
        results.map((z) => [z.name, z.code || '', z.warehouse_name || ''])
      )
    } catch {
      /* empty */
    }
  }
  const toggleWhSort = (key) => setWhSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  const toggleZoneSort = (key) => setZoneSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))

  return (
    <div className={styles.page}>
      <ListPageDataPanel
        flushTop
        title={t('warehouse.title')}
        leadExtra={canManage ? (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className={styles.btnAdd} onClick={() => setQuickWhOpen(true)}>
              {t('warehouse.newWarehouse')}
            </button>
            <button type="button" className={styles.btnAdd} onClick={() => openZoneModal('')}>
              {t('warehouse.newZone')}
            </button>
          </div>
        ) : null}
        loading={loadingWh}
        exportButton={(
          <button type="button" className={toolbarStyles.btnExport} onClick={exportWarehouses} disabled={loadingWh}>
            {t('common.exportExcel')}
          </button>
        )}
        search={(
          <ToolbarSearchInput
            value={whSearch}
            onChange={(e) => {
              setWhSearch(e.target.value)
              setWhPage(1)
            }}
            placeholder={t('common.searchPlaceholder')}
            aria-label={t('warehouse.warehousesSection')}
          />
        )}
        filters={null}
      >
        <h2 className={styles.h2} style={{ margin: '0 0 4px' }}>{t('warehouse.warehousesSection')}</h2>
        <div className={`${styles.tableWrap} ${panelStyles.dataPanelTableWrap}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>№</th>
                  <SortHeader className={styles.sortableHeader} label={t('warehouse.nameCol')} sortKey="name" activeKey={whSort.key} sortDir={whSort.dir} onToggle={toggleWhSort} />
                  <SortHeader className={styles.sortableHeader} label={t('warehouse.address')} sortKey="address" activeKey={whSort.key} sortDir={whSort.dir} onToggle={toggleWhSort} />
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {sortedWarehouses.map((w, idx) => (
                  <tr key={w.id}>
                    <td>{(whPage - 1) * whPageSize + idx + 1}</td>
                    <td>{w.name}</td>
                    <td>{w.address || t('common.none')}</td>
                    {canManage && (
                      <td className={styles.actions}>
                        <button type="button" className={styles.btnSm} onClick={() => openZoneModal(w.id)}>
                          {t('warehouse.addZoneShort')}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
        <div className={styles.paginationDock}>
          <PaginationBar
            page={whPage}
            pageCount={whPages}
            total={whCount}
            onPageChange={setWhPage}
            pageSize={whPageSize}
            onPageSizeChange={(size) => { setWhPageSize(size); setWhPage(1) }}
            disabled={loadingWh}
          />
        </div>
      </ListPageDataPanel>

      <ListPageDataPanel
        title={t('warehouse.zonesSection')}
        titleTag="h2"
        loading={loadingZn}
        exportButton={(
          <button type="button" className={toolbarStyles.btnExport} onClick={exportZones} disabled={loadingZn}>
            {t('common.exportExcel')}
          </button>
        )}
        search={(
          <ToolbarSearchInput
            value={zoneSearch}
            onChange={(e) => {
              setZoneSearch(e.target.value)
              setZonePage(1)
            }}
            placeholder={t('common.searchPlaceholder')}
            aria-label={t('warehouse.zonesSection')}
          />
        )}
        filters={(
          <>
            <ToolbarFilterSelect
              value={zoneWarehouse}
              onChange={(e) => {
                setZoneWarehouse(e.target.value)
                setZonePage(1)
              }}
              aria-label={t('warehouse.wh')}
            >
              <option value="">{t('common.all')} — {t('warehouse.wh')}</option>
              {whListForFilter.map((w) => (
                <option key={w.id} value={String(w.id)}>
                  {w.name}
                </option>
              ))}
            </ToolbarFilterSelect>
          </>
        )}
      >
        <div className={`${styles.tableWrap} ${panelStyles.dataPanelTableWrap}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>№</th>
                  <SortHeader className={styles.sortableHeader} label={t('warehouse.zoneName')} sortKey="name" activeKey={zoneSort.key} sortDir={zoneSort.dir} onToggle={toggleZoneSort} />
                  <SortHeader className={styles.sortableHeader} label={t('warehouse.zoneCode')} sortKey="code" activeKey={zoneSort.key} sortDir={zoneSort.dir} onToggle={toggleZoneSort} />
                  <SortHeader className={styles.sortableHeader} label={t('warehouse.wh')} sortKey="warehouse" activeKey={zoneSort.key} sortDir={zoneSort.dir} onToggle={toggleZoneSort} />
                </tr>
              </thead>
              <tbody>
                {sortedZones.map((z, idx) => (
                  <tr key={z.id}>
                    <td>{(zonePage - 1) * zonePageSize + idx + 1}</td>
                    <td>{z.name}</td>
                    <td>{z.code || t('common.none')}</td>
                    <td>{z.warehouse_name || whListForFilter.find((w) => w.id === z.warehouse)?.name || t('common.none')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
        <div className={styles.paginationDock}>
          <PaginationBar
            page={zonePage}
            pageCount={zonePages}
            total={zoneCount}
            onPageChange={setZonePage}
            pageSize={zonePageSize}
            onPageSizeChange={(size) => { setZonePageSize(size); setZonePage(1) }}
            disabled={loadingZn}
          />
        </div>
      </ListPageDataPanel>

      {canManage && (
        <>
          <QuickWarehouseModal
            open={quickWhOpen}
            onClose={() => setQuickWhOpen(false)}
            stackDepth={0}
            onCreated={reloadAfterModal}
          />
          <QuickZoneModal
            open={quickZoneOpen}
            onClose={() => setQuickZoneOpen(false)}
            defaultWarehouseId={defaultWarehouseForZone}
            stackDepth={0}
            onCreated={reloadAfterModal}
          />
        </>
      )}
    </div>
  )
}
