import { useState, useEffect, useCallback } from 'react'
import {
  fetchMySite,
  updateSiteSection,
  reorderSiteSections,
  uploadSiteImage,
  type TenantSite,
} from '@/services/core/site-service'

export function useSite() {
  const [site, setSite] = useState<TenantSite | null>(null)
  const [loading, setLoading] = useState(true)
  const [notConfigured, setNotConfigured] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setNotConfigured(false)
    try {
      const data = await fetchMySite()
      setSite(data)
    } catch (e: unknown) {
      const err = e as { response?: { status?: number } }
      if (err?.response?.status === 404) {
        setNotConfigured(true)
      } else {
        setError('Error al cargar la tienda en línea')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const saveSection = useCallback(
    async (sectionId: string, patch: { content?: Record<string, unknown>; isActive?: boolean }) => {
      setSavingId(sectionId)
      try {
        const updated = await updateSiteSection(sectionId, patch)
        setSite((prev) =>
          prev
            ? { ...prev, siteSections: prev.siteSections.map((s) => (s.id === sectionId ? updated : s)) }
            : prev,
        )
        return true
      } catch {
        return false
      } finally {
        setSavingId(null)
      }
    },
    [],
  )

  const moveSection = useCallback(
    async (sectionId: string, direction: 'up' | 'down') => {
      if (!site) return
      const ordered = [...site.siteSections].sort((a, b) => a.sortOrder - b.sortOrder)
      const index = ordered.findIndex((s) => s.id === sectionId)
      const swapWith = direction === 'up' ? index - 1 : index + 1
      if (index < 0 || swapWith < 0 || swapWith >= ordered.length) return

      const next = [...ordered]
      ;[next[index], next[swapWith]] = [next[swapWith], next[index]]

      setReordering(true)
      try {
        const updated = await reorderSiteSections(next.map((s) => s.id))
        setSite(updated)
      } catch {
        // deja el orden anterior si falla
      } finally {
        setReordering(false)
      }
    },
    [site],
  )

  const uploadImage = useCallback(async (file: File) => {
    const { url } = await uploadSiteImage(file)
    return url
  }, [])

  return {
    site,
    loading,
    notConfigured,
    error,
    savingId,
    reordering,
    reload: load,
    saveSection,
    moveSection,
    uploadImage,
  }
}
