import { test, expect } from '@playwright/test'

test.describe('Login', () => {
  test('redirects unauthenticated users to /login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible()
  })

  test('shows validation errors for empty form', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: /Se connecter/ }).click()
    await expect(page.getByText(/Email requis/)).toBeVisible()
    await expect(page.getByText(/mot de passe/i)).toBeVisible()
  })
})
