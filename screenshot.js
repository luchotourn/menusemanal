import puppeteer from 'puppeteer';

async function takeScreenshots() {
  console.log('🚀 Starting screenshot capture...');
  
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Set viewport to desktop size
  await page.setViewport({ width: 1200, height: 800 });
  
  try {
    console.log('📱 Navigating to Menu Semanal app...');
    await page.goto('http://localhost:3001', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    // Wait a bit more for any animations or loading
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('📸 Taking desktop screenshot...');
    await page.screenshot({ 
      path: 'menu-semanal-desktop.png',
      fullPage: true
    });
    
    // Switch to mobile viewport
    console.log('📱 Switching to mobile view...');
    await page.setViewport({ width: 375, height: 667 });
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('📸 Taking mobile screenshot...');
    await page.screenshot({ 
      path: 'menu-semanal-mobile.png',
      fullPage: true
    });
    
    console.log('✅ Screenshots saved successfully!');
    console.log('   • menu-semanal-desktop.png');
    console.log('   • menu-semanal-mobile.png');
    
  } catch (error) {
    console.error('❌ Error taking screenshots:', error.message);
  } finally {
    await browser.close();
  }
}

takeScreenshots();