const puppeteer = require('puppeteer');

module.exports = async (req, res) => {
  // Enable CORS for Google Sites
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto('https://uplight.com/library/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for resources to load
    await page.waitForSelector('[class*="resource"], [class*="card"], [class*="item"]', {
      timeout: 10000
    }).catch(() => {});

    // Extract resource data
    const resources = await page.evaluate(() => {
      const items = [];
      
      // Try multiple selectors to find resource elements
      const selectors = [
        'article',
        '[class*="resource"]',
        '[class*="card"]',
        '[class*="item"]',
        '[data-resource]'
      ];

      let elements = [];
      for (const selector of selectors) {
        elements = document.querySelectorAll(selector);
        if (elements.length > 0) break;
      }

      elements.forEach((element) => {
        // Find thumbnail image
        const img = element.querySelector('img');
        const thumbnail = img ? img.src || img.getAttribute('data-src') : null;

        // Find title
        const titleElement = element.querySelector('h1, h2, h3, h4, [class*="title"], a[href]');
        const title = titleElement ? titleElement.textContent.trim() : '';

        // Only add if we have both thumbnail and title
        if (thumbnail && title) {
          items.push({
            id: items.length + 1,
            title: title,
            thumbnail: thumbnail,
            url: element.querySelector('a')?.href || ''
          });
        }
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
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

