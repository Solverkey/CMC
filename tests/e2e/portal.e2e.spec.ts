import { expect, test } from '@playwright/test'

test('desde la web pública se llega al acceso de clientes', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Principal' }).first().getByRole('link', { name: 'Acceso clientes' }).click()
  await expect(page).toHaveURL(/\/portal\/login/)
  await expect(page.getByRole('heading', { name: 'Acceso al portal' })).toBeVisible()
})

test('el panel de administración redirige al acceso del portal', async ({ page }) => {
  await page.goto('/admin/login')
  await expect(page).toHaveURL(/\/portal\/login\?next=%2Fadmin/)
})

test('credenciales incorrectas muestran un aviso', async ({ page }) => {
  await page.goto('/portal/login')
  await page.getByLabel('Correo electrónico').fill('nadie@ejemplo.test')
  await page.getByLabel('Contraseña', { exact: true }).fill('NoEsLaClave2026')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.locator('main [role=alert], form [role=alert]').first()).toContainText('incorrectos')
})

test('un usuario de empresa entra y ve su panel', async ({ page }) => {
  test.skip(!process.env.E2E_EMAIL, 'Defina E2E_EMAIL y E2E_PASSWORD (por ejemplo, los del seed).')
  await page.goto('/portal/login')
  await page.getByLabel('Correo electrónico').fill(process.env.E2E_EMAIL!)
  await page.getByLabel('Contraseña', { exact: true }).fill(process.env.E2E_PASSWORD!)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/portal$/)
  await expect(page.getByRole('navigation', { name: 'Portal' })).toBeVisible()
})
