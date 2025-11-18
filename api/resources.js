const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

// Set graphics mode to false for serverless environments
chromium.setGraphicsMode(false);

module.exports = async (req, res) => {
  // Enable CORS for Google Sites
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let browser;
  try {
    const executablePath = await chromium.executablePath();
    
    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-setuid-sandbox',
        '--no-sandbox',
      ],
      defaultViewport: chromium.defaultViewport,
      executablePath: executablePath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.goto('https://uplight.com/library/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Wait for page to fully load
    await page.waitForTimeout(3000);

    // Scroll to load all resources (handles lazy loading)
    let lastHeight = await page.evaluate('document.body.scrollHeight');
    let scrollAttempts = 0;
    const maxScrolls = 15;

    while (scrollAttempts < maxScrolls) {
      await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
      await page.waitForTimeout(2000);
      
      const newHeight = await page.evaluate('document.body.scrollHeight');
      if (newHeight === lastHeight) break;
      lastHeight = newHeight;
      scrollAttempts++;
    }

    // Scroll back to top
    await page.evaluate('window.scrollTo(0, 0)');
    await page.waitForTimeout(1000);

    // Wait for library items to load
    await page.waitForSelector('div.library__item', {
      timeout: 15000
    }).catch(() => {});

    // Extract resource data - use the specific library__item selector
    const resources = await page.evaluate(() => {
      const items = [];
      
      // Find all library items (both active and inactive)
      const libraryItems = document.querySelectorAll('div.library__item');
      
      libraryItems.forEach((item, index) => {
        // Find the link within the item
        const link = item.querySelector('a[href]');
        if (!link) return;
        
        const href = link.getAttribute('href');
        if (!href || href === '#' || href === '/library/') return;
        
        // Skip filter and category links
        if (href.includes('/filter') || href.includes('/category')) return;
        
        // Get the full URL
        const fullUrl = href.startsWith('http') ? href : `https://uplight.com${href}`;
        
        // Extract title - look for heading or use link text
        let title = '';
        const heading = item.querySelector('h1, h2, h3, h4, h5, h6, [class*="title"], [class*="Title"]');
        if (heading) {
          title = heading.textContent.trim();
        } else {
          // Try to find title in link or nearby text
          title = link.textContent.trim();
          // If link text is too short, look for other text in the item
          if (!title || title.length < 5) {
            const itemText = item.textContent.trim();
            const lines = itemText.split('\n').map(l => l.trim()).filter(l => l.length > 5);
            if (lines.length > 0) {
              title = lines[0].substring(0, 200);
            }
          }
        }
        
        // Skip if no title
        if (!title || title.length < 3) return;
        
        // Extract thumbnail
        let thumbnail = null;
        const img = item.querySelector('img');
        if (img) {
          thumbnail = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('srcset')?.split(' ')[0];
          
          // Convert relative URLs to absolute
          if (thumbnail && thumbnail.startsWith('/')) {
            thumbnail = `https://uplight.com${thumbnail}`;
          }
        }
        
        // Clean up title
        title = title.replace(/\s+/g, ' ').trim();
        
        items.push({
          id: index + 1,
          title: title,
          thumbnail: thumbnail,
          url: fullUrl
        });
      });

      return items;
    });

    await browser.close();

    // Cache the response for 1 hour
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    res.status(200).json({
      success: true,
      count: resources.length,
      resources: resources
    });

  } catch (error) {
    console.error('Scraping error:', error);
    
    // Ensure browser is closed on error
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

