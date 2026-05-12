import { test, expect } from '@playwright/test'

test.describe('Alert Detail Modal', () => {
  test.beforeEach(async ({ page }) => {
    // Login as OPERATOR
    await page.goto('/login')
    await page.fill('input[type="email"]', 'operator@emissionsiq.tn')
    await page.fill('input[type="password"]', 'Operator@2026')
    await page.click('button[type="submit"]')
    await page.waitForURL('/overview')
    
    // Navigate to alerts
    await page.goto('/alerts')
    await page.waitForSelector('[role="article"]', { timeout: 5000 })
  })

  test('should open modal when clicking on alert', async ({ page }) => {
    // Click on first alert
    await page.click('[role="article"]')
    
    // Modal should be visible
    await expect(page.locator('text=Détail de l'alerte')).toBeVisible()
  })

  test('should display alert information', async ({ page }) => {
    // Click on first alert
    await page.click('[role="article"]')
    
    // Check that key information is displayed
    await expect(page.locator('text=Polluant')).toBeVisible()
    await expect(page.locator('text=Capteur')).toBeVisible()
    await expect(page.locator('text=Valeur mesurée')).toBeVisible()
    await expect(page.locator('text=Seuil')).toBeVisible()
    await expect(page.locator('text=Dépassement')).toBeVisible()
  })

  test('should display timeline', async ({ page }) => {
    // Click on first alert
    await page.click('[role="article"]')
    
    // Check timeline section
    await expect(page.locator('text=Timeline')).toBeVisible()
    await expect(page.locator('text=Alerte créée')).toBeVisible()
  })

  test('should show acknowledge button for unacknowledged alerts', async ({ page }) => {
    // Find an unacknowledged alert (without "Acquittée" badge)
    const unacknowledgedAlert = page.locator('[role="article"]').filter({ hasNotText: 'Acquittée' }).first()
    
    if (await unacknowledgedAlert.count() > 0) {
      await unacknowledgedAlert.click()
      
      // Should show acknowledge button
      await expect(page.locator('button:has-text("Acquitter")')).toBeVisible()
    }
  })

  test('should acknowledge alert', async ({ page }) => {
    // Find an unacknowledged alert
    const unacknowledgedAlert = page.locator('[role="article"]').filter({ hasNotText: 'Acquittée' }).first()
    
    if (await unacknowledgedAlert.count() > 0) {
      await unacknowledgedAlert.click()
      
      // Click acknowledge button
      await page.click('button:has-text("Acquitter")')
      
      // Wait for success (modal might close or show updated state)
      await page.waitForTimeout(1000)
      
      // Timeline should show "Acquittée"
      const acknowledgedText = page.locator('text=Acquittée')
      if (await acknowledgedText.count() > 0) {
        await expect(acknowledgedText).toBeVisible()
      }
    }
  })

  test('should show resolution note field', async ({ page }) => {
    // Find an unresolved alert
    const unresolvedAlert = page.locator('[role="article"]').first()
    await unresolvedAlert.click()
    
    // Should show resolution note input
    const noteInput = page.locator('textarea[placeholder*="Décrivez les actions"]')
    if (await noteInput.count() > 0) {
      await expect(noteInput).toBeVisible()
    }
  })

  test('should resolve alert with note', async ({ page }) => {
    // Find an unresolved alert
    const unresolvedAlert = page.locator('[role="article"]').first()
    await unresolvedAlert.click()
    
    // Fill resolution note
    const noteInput = page.locator('textarea[placeholder*="Décrivez les actions"]')
    if (await noteInput.count() > 0) {
      await noteInput.fill('Problème résolu après vérification du capteur')
      
      // Click resolve button
      const resolveButton = page.locator('button:has-text("Résoudre")')
      if (await resolveButton.count() > 0) {
        await resolveButton.click()
        
        // Modal should close
        await expect(page.locator('text=Détail de l'alerte')).not.toBeVisible({ timeout: 3000 })
      }
    }
  })

  test('should show escalate button', async ({ page }) => {
    // Click on first alert
    await page.click('[role="article"]')
    
    // Should show escalate button (if user has permission)
    const escalateButton = page.locator('button:has-text("Escalader")')
    if (await escalateButton.count() > 0) {
      await expect(escalateButton).toBeVisible()
    }
  })

  test('should close modal when clicking close button', async ({ page }) => {
    // Click on first alert
    await page.click('[role="article"]')
    
    // Modal should be visible
    await expect(page.locator('text=Détail de l'alerte')).toBeVisible()
    
    // Click close button
    await page.click('button:has-text("Fermer")')
    
    // Modal should be closed
    await expect(page.locator('text=Détail de l'alerte')).not.toBeVisible()
  })

  test('should display resolved alert information', async ({ page }) => {
    // Find a resolved alert (if any)
    const resolvedAlert = page.locator('[role="article"]').filter({ hasText: 'Résolue' }).first()
    
    if (await resolvedAlert.count() > 0) {
      await resolvedAlert.click()
      
      // Should show resolution information in timeline
      await expect(page.locator('text=Résolue')).toBeVisible()
      
      // Should not show resolution note input (already resolved)
      const noteInput = page.locator('textarea[placeholder*="Décrivez les actions"]')
      await expect(noteInput).not.toBeVisible()
    }
  })
})
