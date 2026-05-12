import { test, expect } from '@playwright/test'

test.describe('Reports Generation & Export', () => {
  test.beforeEach(async ({ page }) => {
    // Login as SUPER_ADMIN
    await page.goto('/login')
    await page.fill('input[type="email"]', 'admin@emissionsiq.tn')
    await page.fill('input[type="password"]', 'Admin@2026')
    await page.click('button[type="submit"]')
    await page.waitForURL('/overview')
  })

  test('should navigate to reports page', async ({ page }) => {
    await page.goto('/reports')
    await expect(page.locator('h1')).toContainText('Rapports')
  })

  test('should open report generation modal', async ({ page }) => {
    await page.goto('/reports')
    
    // Click "Nouveau rapport" button
    await page.click('button:has-text("Nouveau rapport")')
    
    // Modal should be visible
    await expect(page.locator('text=Nouveau rapport')).toBeVisible()
    await expect(page.locator('text=Configurez la période')).toBeVisible()
  })

  test('should generate PDF report', async ({ page }) => {
    await page.goto('/reports')
    
    // Open modal
    await page.click('button:has-text("Nouveau rapport")')
    
    // Fill form
    await page.fill('input[label="Titre"]', 'Test E2E PDF Report')
    await page.fill('input[type="date"]', '2026-04-01')
    await page.fill('input[type="date"]:nth-of-type(2)', '2026-04-23')
    
    // Select PDF format (should be default)
    await expect(page.locator('select[label="Format"]')).toHaveValue('pdf')
    
    // Submit
    await page.click('button:has-text("Générer")')
    
    // Wait for success toast
    await expect(page.locator('text=Rapport généré')).toBeVisible({ timeout: 10000 })
    
    // Check that report appears in table
    await expect(page.locator('text=Test E2E PDF Report')).toBeVisible()
  })

  test('should generate CSV report', async ({ page }) => {
    await page.goto('/reports')
    
    // Open modal
    await page.click('button:has-text("Nouveau rapport")')
    
    // Fill form
    await page.fill('input[label="Titre"]', 'Test E2E CSV Report')
    await page.fill('input[type="date"]', '2026-04-01')
    await page.fill('input[type="date"]:nth-of-type(2)', '2026-04-23')
    
    // Select CSV format
    await page.selectOption('select[label="Format"]', 'csv')
    
    // Submit
    await page.click('button:has-text("Générer")')
    
    // Wait for success
    await expect(page.locator('text=Rapport généré')).toBeVisible({ timeout: 10000 })
    
    // Check that report appears in table
    await expect(page.locator('text=Test E2E CSV Report')).toBeVisible()
  })

  test('should download report file', async ({ page }) => {
    await page.goto('/reports')
    
    // Wait for reports to load
    await page.waitForSelector('table', { timeout: 5000 })
    
    // Find first download link
    const downloadLink = page.locator('a:has-text("Télécharger")').first()
    
    if (await downloadLink.count() > 0) {
      // Start waiting for download before clicking
      const downloadPromise = page.waitForEvent('download')
      await downloadLink.click()
      
      const download = await downloadPromise
      
      // Check filename
      expect(download.suggestedFilename()).toMatch(/report_.*\.(pdf|csv)/)
      
      // Save file
      const path = await download.path()
      expect(path).toBeTruthy()
    } else {
      console.log('No reports available for download test')
    }
  })

  test('should display report metadata correctly', async ({ page }) => {
    await page.goto('/reports')
    
    // Wait for table
    await page.waitForSelector('table')
    
    // Check table headers
    await expect(page.locator('th:has-text("Titre")')).toBeVisible()
    await expect(page.locator('th:has-text("Période")')).toBeVisible()
    await expect(page.locator('th:has-text("Format")')).toBeVisible()
    await expect(page.locator('th:has-text("Généré")')).toBeVisible()
    await expect(page.locator('th:has-text("Statut")')).toBeVisible()
  })

  test('should show empty state when no reports', async ({ page }) => {
    // This test assumes a clean database or filtered view
    await page.goto('/reports')
    
    // If no reports, should show empty state
    const emptyState = page.locator('text=Aucun rapport')
    const hasReports = await page.locator('table tbody tr').count() > 0
    
    if (!hasReports) {
      await expect(emptyState).toBeVisible()
    }
  })
})
