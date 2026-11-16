import { expect, test } from '@playwright/test'

for (const [ruta, titulo] of [
  ['/', 'Calidad y medio ambiente'],
  ['/servicios', 'Calidad, medio ambiente y gestión'],
  ['/trabajos', 'Referencias'],
  ['/quienes-somos', 'Más de veinte años'],
  ['/contacto', 'Hablemos de su proyecto'],
  ['/aviso-legal', 'Aviso legal'],
  ['/privacidad', 'Política de privacidad'],
  ['/cookies', 'Política de cookies'],
] as const) {
  test(`la página ${ruta} carga`, async ({ page }) => {
    const r = await page.goto(ruta)
    expect(r?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(titulo)
    expect(r?.headers()['x-robots-tag']).toBeUndefined()
  })
}

test('el portal no se indexa', async ({ request }) => {
  const r = await request.get('/portal/login')
  expect(r.headers()['x-robots-tag']).toContain('noindex')
  const robots = await (await request.get('/robots.txt')).text()
  expect(robots).toContain('Disallow: /portal')
})

test('el formulario de contacto valida los campos', async ({ page }) => {
  await page.goto('/contacto')
  await page.waitForTimeout(3500)
  await page.getByLabel('Correo electrónico').fill('no-es-un-correo')
  await page.getByRole('button', { name: 'Enviar consulta' }).click()
  await expect(page.locator('p[role=alert]')).toContainText('Revise los campos')
  await expect(page.getByText('Indique un correo electrónico válido.')).toBeVisible()
})

test('en móvil el menú se abre y se cierra al navegar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByLabel('Menú').click()
  await page.getByRole('navigation', { name: 'Principal (móvil)' }).getByRole('link', { name: 'Servicios' }).click()
  await expect(page).toHaveURL(/\/servicios$/)
  await expect(page.getByRole('navigation', { name: 'Principal (móvil)' })).toBeHidden()
})
