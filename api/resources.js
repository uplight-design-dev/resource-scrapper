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

    // Extract resource data - find all links to library resources
    const resources = await page.evaluate(() => {
      const items = [];
      const seenUrls = new Set();

      // Find all links that point to library resources
      const allLinks = document.querySelectorAll('a[href*="/library/"]');
      
      allLinks.forEach((link) => {
        const href = link.getAttribute('href');
        if (!href || href.includes('#') || seenUrls.has(href)) return;
        
        // Skip navigation and filter links
        if (href.includes('/filter') || href.includes('/category') || href === '/library/') return;
        
        seenUrls.add(href);
        
        // Get the full URL
        const fullUrl = href.startsWith('http') ? href : `https://uplight.com${href}`;
        
        // Find the container element (could be parent, grandparent, etc.)
        let container = link;
        for (let i = 0; i < 5; i++) {
          container = container.parentElement;
          if (!container) break;
          
          // Look for common container patterns
          const className = container.className || '';
          if (className.includes('card') || className.includes('item') || 
              className.includes('resource') || className.includes('post') ||
              container.tagName === 'ARTICLE' || container.tagName === 'LI') {
            break;
          }
        }
        
        // Extract title - try multiple methods
        let title = '';
        
        // Method 1: Look for heading elements
        const heading = container.querySelector('h1, h2, h3, h4, h5, h6, [class*="title"], [class*="Title"]');
        if (heading) {
          title = heading.textContent.trim();
        }
        
        // Method 2: Use link text if it's substantial
        if (!title || title.length < 5) {
          const linkText = link.textContent.trim();
          if (linkText && linkText.length > 5 && linkText.length < 200) {
            title = linkText;
          }
        }
        
        // Method 3: Look for any text content in container
        if (!title || title.length < 5) {
          const containerText = container.textContent.trim();
          const lines = containerText.split('\n').map(l => l.trim()).filter(l => l.length > 5);
          if (lines.length > 0) {
            title = lines[0].substring(0, 200);
          }
        }
        
        // Skip if no title found
        if (!title || title.length < 3) return;
        
        // Extract thumbnail - try multiple sources
        let thumbnail = null;
        
        // Look for images in the container
        const img = container.querySelector('img');
        if (img) {
          thumbnail = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('srcset')?.split(' ')[0];
          
          // Convert relative URLs to absolute
          if (thumbnail && thumbnail.startsWith('/')) {
            thumbnail = `https://uplight.com${thumbnail}`;
          }
        }
        
        // Clean up title (remove extra whitespace, newlines)
        title = title.replace(/\s+/g, ' ').trim();
        
        items.push({
          id: items.length + 1,
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

