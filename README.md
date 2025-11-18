# Uplight Resources Scraper & Widget

A serverless scraper and embeddable widget for displaying Uplight library resources. The widget loads resources from a JSON file hosted on GitHub and can be embedded in Google Sites.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Generate the resources JSON file:
```bash
npm run generate-json
```

This will scrape https://uplight.com/library/ and generate `public/resources.json`.

3. Commit and push the `public/resources.json` file to GitHub:
```bash
git add public/resources.json
git commit -m "Update resources.json"
git push
```

4. Deploy to Vercel (optional, for API endpoints):
```bash
vercel
```

## Usage

### Embedding in Google Sites

The widget loads resources from the GitHub raw URL. To embed:

1. Make sure `public/resources.json` is committed and pushed to GitHub
2. In Google Sites:
   - Click "Insert" → "Embed"
   - Choose "Embed code"
   - Use the iframe code from `public/embed-code.html`:
   ```html
   <iframe 
     src="https://resource-scrapper.vercel.app/widget.html" 
     width="100%" 
     height="800" 
     frameborder="0" 
     scrolling="no"
     style="border: none; overflow: hidden;">
   </iframe>
   ```

### API Endpoints

- `GET /api/resources` - Returns JSON with all scraped resources (live scraping)
- `GET /api/generate-json` - Generates and returns JSON (can be used to update the static file)

### Updating Resources

To update the resources JSON file:

1. Run the generator:
   ```bash
   npm run generate-json
   ```

2. Commit and push the updated file:
   ```bash
   git add public/resources.json
   git commit -m "Update resources"
   git push
   ```

The widget will automatically use the updated JSON from GitHub.

## Widget Features

- **Search**: Filter resources by title or type
- **Responsive**: Works on all screen sizes
- **Item Types**: Displays resource type (Press Release, Blog, Report, etc.)
- **Thumbnails**: Shows resource images with fallback
- **Google Sites Compatible**: Simple, self-contained code

## Notes

- The scraper uses Puppeteer to handle dynamic content and infinite scroll
- The widget loads from GitHub raw URLs for reliability
- Make sure to comply with Uplight's terms of service

