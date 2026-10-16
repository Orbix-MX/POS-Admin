import { test, expect, type Page } from '@playwright/test'

/**
 * @odd aislamiento-de-cupones T-003 (A-1)
 * El API responde 409 ACCOUNT_SHARED al intentar cambiar el correo o el nombre de una persona que también trabaja en
 * otra empresa. El hook tragaba el error con `console.error`: el administrador pulsaba "Guardar" y no veía nada.
 */

const MESSAGE = 'Esta persona también trabaja en otra empresa de Orbix: su correo y su nombre solo los puede cambiar ella misma o el soporte de Orbix.'

async function setup(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'e2e-fake-token')
    localStorage.setItem('refresh_token', 'e2e-fake-refresh')
  })
  const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })

  // Catch-all de menor prioridad (Playwright usa LIFO).
  await page.route('**/api/**', (route) => route.fulfill(json({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } })))
  await page.route('**/api/auth/me', (route) =>
    route.fulfill(
      json({
        user: { id: 'u-admin', email: 'admin@e2e.test', firstName: 'Ada', lastName: 'Admin' },
        permissions: ['users:view', 'users:edit', 'users:create', 'users:delete', 'roles:view'],
        currentBranchId: null,
      }),
    ),
  )
  await page.route('**/api/auth/me/capabilities', (route) =>
    route.fulfill(json({ plan: 'PRO', effectiveModules: ['dashboard', 'usuarios'], enabledFeatures: [] })),
  )
  await page.route('**/api/branches', (route) => route.fulfill(json([])))
  await page.route('**/api/roles', (route) => route.fulfill(json([])))
  await page.route('**/api/users/capacity', (route) =>
    route.fulfill(json({ maxUsers: null, activeUsers: 2, overUserLimit: false, hasCapacity: true })),
  )
  await page.route('**/api/users?**', (route) =>
    route.fulfill(
      json({
        data: [
          {
            id: 'u-externa', email: 'contadora@externa.test', firstName: 'Carla', lastName: 'Externa',
            role: 'STAFF', status: 'ACTIVE', isOwner: false, createdAt: new Date().toISOString(),
          },
        ],
        meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
      }),
    ),
  )
  await page.route('**/api/users/u-externa', (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback()
    return route.fulfill(json({ statusCode: 409, code: 'ACCOUNT_SHARED', message: MESSAGE }, 409))
  })
}

test.describe('Usuarios · cuenta compartida (409 ACCOUNT_SHARED)', () => {
  test('el administrador ve el motivo dentro del modal y el modal sigue abierto', async ({ page }) => {
    await setup(page)
    await page.goto('/usuarios')

    await page.getByText('Carla Externa').first().click()
    await page.getByRole('button', { name: 'Editar Usuario' }).click()
    await page.locator('input[type="email"]').fill('otro@correo.test')
    await page.getByRole('button', { name: 'Guardar Cambios' }).click()

    const alert = page.getByRole('alert')
    await expect(alert).toBeVisible()
    await expect(alert).toContainText('también trabaja en otra empresa')
    // No se cerró: puede cancelar o corregir.
    await expect(page.getByRole('button', { name: 'Guardar Cambios' })).toBeVisible()
  })

  test('el error se limpia al cerrar y reabrir el modal', async ({ page }) => {
    await setup(page)
    await page.goto('/usuarios')

    await page.getByText('Carla Externa').first().click()
    await page.getByRole('button', { name: 'Editar Usuario' }).click()
    await page.locator('input[type="email"]').fill('otro@correo.test')
    await page.getByRole('button', { name: 'Guardar Cambios' }).click()
    await expect(page.getByRole('alert')).toBeVisible()

    await page.getByRole('button', { name: 'Cancelar' }).click()
    await page.getByText('Carla Externa').first().click()
    await page.getByRole('button', { name: 'Editar Usuario' }).click()

    await expect(page.getByRole('alert')).toHaveCount(0)
  })
})
