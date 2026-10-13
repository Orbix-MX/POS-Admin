import { test, expect, type Page } from '@playwright/test'

/**
 * @odd acceso-residual-tras-baja T-003
 * Al desactivar a un miembro, el API responde 403 MEMBERSHIP_INACTIVE con su token anterior.
 * El web debe cerrar la sesión local una vez y mostrar el aviso en el login.
 */

const NOTICE = 'Tu acceso a esta empresa fue desactivado'

async function setup(page: Page, onBusinessRequest: () => void) {
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'e2e-fake-token')
    localStorage.setItem('refresh_token', 'e2e-fake-refresh')
  })
  const json = (body: unknown, status = 200) => ({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })

  // Catch-all de menor prioridad (Playwright usa LIFO): toda petición de negocio está revocada.
  await page.route('**/api/**', (route) => {
    onBusinessRequest()
    return route.fulfill(
      json({ statusCode: 403, code: 'MEMBERSHIP_INACTIVE', message: 'Acceso desactivado' }, 403),
    )
  })
  // El arranque con sesión vigente: el token todavía "sirve" para estas dos.
  await page.route('**/api/auth/me', (route) =>
    route.fulfill(
      json({
        user: { id: 'u-1', email: 'ex-miembro@e2e.test', firstName: 'Ex', lastName: 'Miembro' },
        permissions: ['products:read'],
        currentBranchId: null,
      }),
    ),
  )
  await page.route('**/api/auth/me/capabilities', (route) =>
    route.fulfill(json({ plan: 'PRO', effectiveModules: [], enabledFeatures: [] })),
  )
  await page.route('**/api/branches', (route) => route.fulfill(json([])))
}

test.describe('Sesión · acceso revocado (MEMBERSHIP_INACTIVE)', () => {
  test('una petición 403 MEMBERSHIP_INACTIVE cierra la sesión una vez y avisa en el login', async ({ page }) => {
    let revoked = 0
    await setup(page, () => { revoked += 1 })

    await page.goto('/inventario')

    await expect(page.getByText(NOTICE)).toBeVisible()
    await expect(page.getByRole('button', { name: /^Ingresar$/ })).toBeVisible()

    // Sesión local borrada: no queda token con el que insistir.
    const tokens = await page.evaluate(() => ({
      access: localStorage.getItem('access_token'),
      refresh: localStorage.getItem('refresh_token'),
    }))
    expect(tokens).toEqual({ access: null, refresh: null })

    // Sin bucle: tras cerrar la sesión no llegan más peticiones de negocio.
    const seen = revoked
    await page.waitForTimeout(1500)
    expect(revoked).toBe(seen)
  })
})
