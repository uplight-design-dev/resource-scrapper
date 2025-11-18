const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const fs = require('fs');
const path = require('path');

// For local development, use regular puppeteer
// For production, this would be run via API endpoint
async function generateJSON() {
  let browser;
  try {
    // Try to use chromium for serverless, fallback to regular puppeteer for local
    let executablePath;
    try {
      chromium.setGraphicsMode(false);
      executablePath = await chromium.executablePath();
    } catch (e) {
      // Local development - use system Chrome or install puppeteer
      const puppeteerFull = require('puppeteer');
      executablePath = null; // Use default
      browser = await puppeteerFull.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }

    if (!browser) {
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
    }

    const page = await browser.newPage();
    await page.goto('https://uplight.com/library/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await page.waitForTimeout(3000);

    // Scroll to load all resources
    let lastHeight = await page.evaluate('document.body.scrollHeight');
    let scrollAttempts = 0;
    const maxScrolls = 50; // More scrolls for 800+ items
    let noChangeCount = 0;

    while (scrollAttempts < maxScrolls) {
      await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
      await page.waitForTimeout(2500);
      
      const newHeight = await page.evaluate('document.body.scrollHeight');
      if (newHeight === lastHeight) {
        noChangeCount++;
        if (noChangeCount >= 3) break;
      } else {
        noChangeCount = 0;
      }
      lastHeight = newHeight;
      scrollAttempts++;
    }

    await page.evaluate('window.scrollTo(0, 0)');
    await page.waitForTimeout(2000);

    await page.waitForSelector('div.library__item', {
      timeout: 15000
    }).catch(() => {});

    // Extract resource data
    const resources = await page.evaluate(() => {
      const items = [];
      const seenUrls = new Set();
      
      const libraryItems = document.querySelectorAll('div.library__item');
      
      libraryItems.forEach((item, index) => {
        const link = item.querySelector('a[href]');
        if (!link) return;
        
        const href = link.getAttribute('href');
        if (!href || href === '#' || href === '/library/') return;
        if (href.includes('/filter') || href.includes('/category')) return;
        
        const fullUrl = href.startsWith('http') ? href : `https://uplight.com${href}`;
        if (seenUrls.has(fullUrl)) return;
        seenUrls.add(fullUrl);
        
        // Extract title
        let title = '';
        const heading = item.querySelector('h1, h2, h3, h4, h5, h6, [class*="title"], [class*="Title"]');
        if (heading) {
          title = heading.textContent.trim();
        } else {
          title = link.textContent.trim();
          if (!title || title.length < 5) {
            const itemText = item.textContent.trim();
            const lines = itemText.split('\n').map(l => l.trim()).filter(l => l.length > 5);
            if (lines.length > 0) {
              title = lines[0].substring(0, 200);
            }
          }
        }
        
        if (!title || title.length < 3) return;
        
        // Extract thumbnail
        let thumbnail = null;
        const img = item.querySelector('img');
        if (img) {
          thumbnail = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('srcset')?.split(' ')[0];
          if (thumbnail && thumbnail.startsWith('/')) {
            thumbnail = `https://uplight.com${thumbnail}`;
          }
        }
        
        // Extract item type
        let itemType = '';
        const itemText = item.textContent || '';
        const typePatterns = [
          'Press Release', 'Blog', 'Report', 'Case Study', 'eBook', 
          'Video', 'White Paper', 'Article', 'Brief', 'Podcast'
        ];
        
        for (const type of typePatterns) {
          const typeIndex = itemText.indexOf(type);
          if (typeIndex !== -1 && typeIndex < 300) {
            itemType = type;
            break;
          }
        }
        
        if (!itemType) {
          const typeElements = item.querySelectorAll('span, div, p, [class*="type"], [class*="Type"], [class*="badge"], [class*="Badge"]');
          for (const el of typeElements) {
            const elText = el.textContent.trim();
            for (const type of typePatterns) {
              if (elText === type || elText.includes(type)) {
                itemType = type;
                break;
              }
            }
            if (itemType) break;
          }
        }
        
        title = title.replace(/\s+/g, ' ').trim();
        
        items.push({
          id: index + 1,
          title: title,
          thumbnail: thumbnail || '',
          type: itemType || 'Resource',
          url: fullUrl
        });
      });

      return items;
    });

    await browser.close();

    // Remove duplicates
    const uniqueResources = [];
    const urlSet = new Set();
    resources.forEach(resource => {
      if (!urlSet.has(resource.url)) {
        urlSet.add(resource.url);
        uniqueResources.push(resource);
      }
    });

    // Write JSON file to public folder
    const jsonData = {
      success: true,
      count: uniqueResources.length,
      lastUpdated: new Date().toISOString(),
      resources: uniqueResources
    };

    const publicDir = path.join(__dirname, '..', 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    const jsonPath = path.join(publicDir, 'resources.json');
    fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));

    console.log(`✅ Generated resources.json with ${uniqueResources.length} resources`);
    console.log(`📁 Saved to: ${jsonPath}`);

    return jsonData;

  } catch (error) {
    console.error('Error generating JSON:', error);
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  generateJSON()
    .then(() => {
      console.log('✅ JSON generation complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ JSON generation failed:', error);
      process.exit(1);
    });
}

module.exports = generateJSON;

