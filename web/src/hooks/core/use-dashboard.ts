import { useCallback, useEffect, useRef, useState } from 'react'
import type { DashboardConfig, WidgetConfig, WidgetResponse } from '@/services/core/dashboards-service'
import { fetchActiveDashboard, fetchWidgetData } from '@/services/core/dashboards-service'

export type { DashboardConfig, WidgetConfig, WidgetResponse }

export function useDashboard() {
  const [dashboard, setDashboard] = useState<DashboardConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setDashboard(await fetchActiveDashboard())
    } catch {
      setError('No se encontró un dashboard activo')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { dashboard, loading, error, reload: load }
}

export function useWidgetData(widget: WidgetConfig) {
  const [data, setData] = useState<WidgetResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const doFetch = useCallback(async () => {
    try {
      const result = await fetchWidgetData(
        widget.id,
        widget.defaultParams as Record<string, string> | null,
      )
      setData(result)
    } catch {
      setData({
        success: false,
        widgetType: widget.widgetType,
        title: widget.title,
        data: null,
        meta: {},
        config: {},
        error: 'Error al cargar el widget',
        lastUpdate: new Date().toISOString(),
      })
    } finally {
      setLoading(false)
    }
  }, [widget.id, widget.defaultParams])

  useEffect(() => {
    doFetch()
    if (widget.refreshSeconds && widget.refreshSeconds > 0) {
      intervalRef.current = setInterval(doFetch, widget.refreshSeconds * 1000)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [doFetch, widget.refreshSeconds])

  return { data, loading }
}
