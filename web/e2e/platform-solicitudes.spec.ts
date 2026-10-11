import { test, expect, type Page } from '@playwright/test'

/**
 * Platform · bandeja de solicitudes de "Mejorar plan" (S-E): lista las pendientes con
 * empresa, plan actual → pedido, solicitante y nota; "Atendida" y "Cancelar" mandan
 * `PATCH /platform/upgrade-requests/:id` y la sacan de la lista.
 * @odd planes-self-service T-003
 */

const now = new Date().toISOString()

function request(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    tenantId: `tenant-${id}`,
    currentPlan: 'FREE',
    requestedPlan: 'PRO',
    note: null,
    status: 'PENDING',
    handledById: null,
    handledAt: null,
    createdAt: now,
    updatedAt: now,
    tenant: { id: `tenant-${id}`, name: `Empresa ${id}`, slug: `empresa-${id}`, plan: 'FREE', status: 'ACTIVE' },
    requestedBy: { id: 'u-1', email: `${id}@orbix.test`, firstName: 'Ana', lastName: 'López' },
    ...overrides,
  }
}

interface Captured { patches: { id: string; body: unknown }[]; statuses: string[] }

async function setup(page: Page, opts: { patchStatus?: number } = {}): Promise<Captured> {
  const captured: Captured = { patches: [], statuses: [] }
  await page.addInitScript(() => {
    localStorage.setItem('platform_access_token', 'e2e-platform-fake-token')
  })
  const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })

  // Catch-all primero: Playwright prueba las rutas en orden inverso al registro.
  await page.route('**/api/platform/**', route => route.fulfill(json({})))
  await page.route('**/api/platform/upgrade-requests**', route => {
    const req = route.request()
    if (req.method() === 'PATCH') {
      const id = new URL(req.url()).pathname.split('/').pop() ?? ''
      captured.patches.push({ id, body: JSON.parse(req.postData() ?? '{}') })
      return route.fulfill(json({ id }, opts.patchStatus ?? 200))
    }
    const status = new URL(req.url()).searchParams.get('status') ?? 'PENDING'
    captured.statuses.push(status)
    if (status === 'PENDING') {
      return route.fulfill(json([
        request('a', { requestedPlan: 'PLUS', note: 'Necesito cuentas por cobrar', currentPlan: 'PRO', tenant: { id: 'tenant-a', name: 'Café Ruta', slug: 'cafe-ruta', plan: 'PRO', status: 'TRIAL' } }),
        request('b'),
      ]))
    }
    return route.fulfill(json(status === 'HANDLED' ? [request('c', { status: 'HANDLED' })] : []))
  })
  return captured
}

test.describe('Platform · Solicitudes de plan', () => {
  test('lista las pendientes con empresa, planes, solicitante y nota', async ({ page }) => {
    await setup(page)
    await page.goto('/platform/solicitudes')

    const row = page.getByTestId('solicitud-a')
    await expect(row).toBeVisible({ timeout: 8_000 })
    await expect(row).toContainText('Café Ruta')
    await expect(row).toContainText('Ana López')
    await expect(row).toContainText('a@orbix.test')
    await expect(row).toContainText('Necesito cuentas por cobrar')
    await expect(page.getByTestId('solicitud-b')).toContainText('Empresa b')
    await expect(row.getByRole('link', { name: 'Café Ruta' })).toHaveAttribute('href', '/platform/empresas/tenant-a')
  })

  test('"Atendida" manda HANDLED y la quita de pendientes', async ({ page }) => {
    const captured = await setup(page)
    await page.goto('/platform/solicitudes')
    await expect(page.getByTestId('solicitud-a')).toBeVisible({ timeout: 8_000 })

    await page.getByTestId('solicitud-a').getByRole('button', { name: 'Atendida' }).click()

    await expect(page.getByTestId('solicitud-a')).toHaveCount(0)
    await expect(page.getByTestId('solicitud-b')).toBeVisible()
    expect(captured.patches).toEqual([{ id: 'a', body: { status: 'HANDLED' } }])
  })

  test('"Cancelar" manda CANCELLED', async ({ page }) => {
    const captured = await setup(page)
    await page.goto('/platform/solicitudes')
    await expect(page.getByTestId('solicitud-b')).toBeVisible({ timeout: 8_000 })

    await page.getByTestId('solicitud-b').getByRole('button', { name: 'Cancelar' }).click()

    await expect(page.getByTestId('solicitud-b')).toHaveCount(0)
    expect(captured.patches).toEqual([{ id: 'b', body: { status: 'CANCELLED' } }])
  })

  test('las pestañas piden cada estado y las resueltas no tienen acciones', async ({ page }) => {
    const captured = await setup(page)
    await page.goto('/platform/solicitudes')
    await expect(page.getByTestId('solicitud-a')).toBeVisible({ timeout: 8_000 })

    await page.getByRole('tab', { name: 'Atendidas' }).click()
    await expect(page.getByTestId('solicitud-c')).toBeVisible()
    await expect(page.getByTestId('solicitud-c').getByRole('button')).toHaveCount(0)

    await page.getByRole('tab', { name: 'Canceladas' }).click()
    await expect(page.getByTestId('solicitudes-empty')).toContainText('Sin solicitudes canceladas')
    // En desarrollo React monta el efecto dos veces: se compara el orden sin repeticiones.
    expect([...new Set(captured.statuses)]).toEqual(['PENDING', 'HANDLED', 'CANCELLED'])
  })

  test('si otra persona ya la resolvió (404), avisa y recarga la lista', async ({ page }) => {
    const captured = await setup(page, { patchStatus: 404 })
    await page.goto('/platform/solicitudes')
    await expect(page.getByTestId('solicitud-a')).toBeVisible({ timeout: 8_000 })

    await page.getByTestId('solicitud-a').getByRole('button', { name: 'Atendida' }).click()

    await expect(page.getByTestId('solicitudes-error')).toContainText('ya esté resuelta')
    expect(captured.statuses.filter(s => s === 'PENDING').length).toBeGreaterThanOrEqual(2)
  })

  test('el menú de Platform tiene la entrada "Solicitudes"', async ({ page }) => {
    await setup(page)
    await page.goto('/platform/solicitudes')

    await expect(page.getByRole('link', { name: 'Solicitudes' })).toBeVisible({ timeout: 8_000 })
  })
})
