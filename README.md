# Uplight Resources Scraper & Widget

A serverless scraper and embeddable widget for displaying Uplight library resources.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Deploy to Vercel:
```bash
vercel
```

3. Update the API_URL in `public/widget.html` with your Vercel deployment URL.

## Usage

### Embedding in Google Sites

1. Deploy the project to Vercel
2. Get your deployment URL (e.g., `https://your-project.vercel.app`)
3. Access the widget at `https://your-project.vercel.app/widget.html`
4. In Google Sites:
   - Click "Insert" → "Embed"
   - Choose "Embed code"
   - Use an iframe:
   ```html
   <iframe src="https://your-project.vercel.app/widget.html" width="100%" height="800" frameborder="0"></iframe>
   ```

### API Endpoint

- `GET /api/resources` - Returns JSON with all scraped resources

## Notes

- The scraper uses Puppeteer to handle dynamic content
- Results are cached for 1 hour
- Make sure to comply with Uplight's terms of service

