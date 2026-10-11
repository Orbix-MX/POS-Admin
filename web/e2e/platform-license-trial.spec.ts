import { test, expect, type Page } from '@playwright/test'

/**
 * Platform · licencia de una empresa: renovar distingue alargar una prueba de pasar
 * a pago, y «Dar prueba» emite una TRIAL con `POST .../license { plan, trialDays }`.
 * @odd prueba-alta-self-service T-002
 */

const TENANT_ID = 'tenant-e2e-lic'
const now = new Date().toISOString()

const TENANT_MOCK = {
  id: TENANT_ID,
  name: 'Empresa Licencia E2E',
  slug: 'empresa-licencia-e2e',
  status: 'ACTIVE',
  plan: 'FREE',
  enabledModules: [],
  businessVertical: 'RETAIL',
  posOperationMode: 'QUICK_SALE',
  enabledFeatures: [],
  overUserLimit: false,
  userLimitOverride: null,
  ownerUserId: null,
  trialEndsAt: null,
  createdAt: now,
  updatedAt: now,
  branches: [],
  _count: { memberships: 1, orders: 0, products: 0 },
}

function licenseMock(status: string, plan: string) {
  return {
    license: {
      id: 'lic-e2e',
      tenantId: TENANT_ID,
      licenseKey: 'ORBX-E2E-0001',
      status,
      plan,
      startsAt: now,
      expiresAt: status === 'TRIAL' ? new Date(Date.now() + 7 * 86_400_000).toISOString() : null,
      maxUsers: null,
      maxBranches: null,
      maxDevices: null,
      notes: null,
      createdAt: now,
      updatedAt: now,
    },
    validation: { valid: true, status },
  }
}

interface Captured { createBodies: Record<string, unknown>[]; licenseGets: number }

async function setup(page: Page, status: string, plan: string): Promise<Captured> {
  const captured: Captured = { createBodies: [], licenseGets: 0 }
  await page.addInitScript(() => {
    localStorage.setItem('platform_access_token', 'e2e-platform-fake-token')
  })
  const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

  // Catch-all primero: Playwright prueba las rutas en orden inverso al registro.
  await page.route('**/api/platform/**', route => route.fulfill(json({})))
  await page.route(`**/api/platform/tenants/${TENANT_ID}`, route => route.fulfill(json(TENANT_MOCK)))
  await page.route(`**/api/platform/tenants/${TENANT_ID}/audit**`, route =>
    route.fulfill(json({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } })))
  await page.route(`**/api/platform/tenants/${TENANT_ID}/license`, route => {
    if (route.request().method() === 'POST') {
      captured.createBodies.push(JSON.parse(route.request().postData() ?? '{}'))
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(licenseMock('TRIAL', 'PRO').license) })
    }
    captured.licenseGets++
    return route.fulfill(json(licenseMock(status, plan)))
  })
  return captured
}

async function openLicenseTab(page: Page) {
  await page.goto(`/platform/empresas/${TENANT_ID}`)
  await page.getByRole('button', { name: 'Licencia', exact: true }).click()
  await expect(page.getByText('ORBX-E2E-0001')).toBeVisible({ timeout: 8_000 })
}

test.describe('Platform · Licencia — renovar vs dar prueba', () => {
  test('renovar una FREE pagada eligiendo PRO avisa que queda de pago', async ({ page }) => {
    await setup(page, 'ACTIVE', 'FREE')
    await openLicenseTab(page)
    await page.getByRole('button', { name: 'Renovar', exact: true }).click()
    await expect(page.getByText('Renovar licencia')).toBeVisible()

    // Plan resultante FREE: sin aviso
    await expect(page.getByTestId('renew-paid-warning')).toHaveCount(0)
    await expect(page.getByTestId('renew-trial-notice')).toHaveCount(0)

    await page.locator('select').filter({ has: page.locator('option[value="ENTERPRISE"]') }).selectOption('PRO')
    const warning = page.getByTestId('renew-paid-warning')
    await expect(warning).toBeVisible()
    await expect(warning).toContainText('de pago')
    await expect(warning).toContainText('bloqueada')
    await expect(warning).toContainText('Dar prueba')
  })

  test('renovar una TRIAL muestra que sigue siendo prueba', async ({ page }) => {
    await setup(page, 'TRIAL', 'PRO')
    await openLicenseTab(page)
    await page.getByRole('button', { name: 'Renovar', exact: true }).click()

    await expect(page.getByTestId('renew-trial-notice')).toContainText('Sigue siendo prueba')
    await expect(page.getByTestId('renew-paid-warning')).toHaveCount(0)
  })

  test('Dar prueba: PRO 14 días por defecto, sin FREE, envía { plan, trialDays } y refresca', async ({ page }) => {
    const captured = await setup(page, 'ACTIVE', 'FREE')
    await openLicenseTab(page)
    const getsBefore = captured.licenseGets

    await page.getByRole('button', { name: 'Dar prueba' }).click()
    const plan = page.getByLabel('Plan')
    const days = page.getByLabel('Días de prueba')
    await expect(plan).toHaveValue('PRO')
    await expect(days).toHaveValue('14')
    await expect(plan.locator('option[value="FREE"]')).toHaveCount(0)

    const submit = page.getByRole('button', { name: 'Dar prueba' }).last()
    for (const bad of ['0', '91', '2.5']) {
      await days.fill(bad)
      await expect(submit).toBeDisabled()
    }
    await days.fill('30')
    await plan.selectOption('PLUS')
    await submit.click()

    await expect(page.getByText('Cambios guardados correctamente')).toBeVisible({ timeout: 8_000 })
    expect(captured.createBodies).toEqual([{ plan: 'PLUS', trialDays: 30 }])
    expect(captured.licenseGets).toBeGreaterThan(getsBefore)
  })
})
