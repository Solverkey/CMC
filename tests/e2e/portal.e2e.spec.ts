import { expect, test } from '@playwright/test'

test('la raíz lleva al acceso del portal', async ({ page }) => {
  await page.goto('/')
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
  await page.getByLabel('Contraseña').fill('NoEsLaClave2026')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('alert')).toContainText('incorrectos')
})

test('un usuario de empresa entra y ve su panel', async ({ page }) => {
  test.skip(!process.env.E2E_EMAIL, 'Defina E2E_EMAIL y E2E_PASSWORD (por ejemplo, los del seed).')
  await page.goto('/portal/login')
  await page.getByLabel('Correo electrónico').fill(process.env.E2E_EMAIL!)
  await page.getByLabel('Contraseña').fill(process.env.E2E_PASSWORD!)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/portal$/)
  await expect(page.getByRole('navigation', { name: 'Portal' })).toBeVisible()
})
