import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1024 }
  });
  const page = await context.newPage();
  
  try {
    await page.goto('http://localhost:5174/finanzas/', { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForTimeout(2000);
    
    await page.screenshot({ 
      path: 'screenshots/homepage-before-interactions.png', 
      fullPage: true 
    });
    
    console.log('✅ Screenshot captured: screenshots/homepage-before-interactions.png');
  } catch (error) {
    console.error('❌ Error capturing screenshot:', error.message);
  } finally {
    await browser.close();
  }
})();
