import { chromium } from 'playwright';
import { logProgress } from './progress.mjs';

export async function discoverApi(state) {
  if (state.discoveredApi) {
    logProgress(1, 'API already discovered, skipping.');
    return state.discoveredApi;
  }

  logProgress(1, 'Launching browser to discover BookManager API...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  let apiConfig = null;

  // Intercept network requests to find the BookManager API
  page.on('response', async (response) => {
    const url = response.url();

    // BookManager API pattern: look for product list requests
    if (url.includes('bookmanager.com') && url.includes('product')) {
      try {
        const json = await response.json();
        if (json && (json.products || json.data || Array.isArray(json))) {
          logProgress(1, `Found API endpoint: ${url}`);
          apiConfig = {
            baseUrl: new URL(url).origin,
            fullUrl: url,
            headers: Object.fromEntries(response.request().headers ? Object.entries(response.request().headers()) : []),
          };
        }
      } catch {
        // Not JSON, ignore
      }
    }

    // Also look for the shop config / initial data load
    if (url.includes('bookmanager.com/api') || url.includes('bookmanager.com/tbm')) {
      try {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('json')) {
          logProgress(1, `Captured API call: ${url.substring(0, 120)}...`);
          if (!apiConfig) {
            apiConfig = {
              baseUrl: new URL(url).origin,
              fullUrl: url,
              headers: {},
            };
          }
        }
      } catch {
        // ignore
      }
    }
  });

  try {
    logProgress(1, 'Navigating to browse page...');
    await page.goto('https://anotherstoryedu.ca/browse/filter/a/a4to6', {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    // Wait for content to render
    await page.waitForTimeout(5000);

    // Try to extract API config from the page's JavaScript context
    const pageApiConfig = await page.evaluate(() => {
      // BookManager stores config in various global variables
      if (window.__INITIAL_STATE__) return { type: 'initialState', data: window.__INITIAL_STATE__ };
      if (window.__CONFIG__) return { type: 'config', data: window.__CONFIG__ };

      // Try to find API base from script tags or meta tags
      const scripts = document.querySelectorAll('script');
      for (const s of scripts) {
        if (s.textContent.includes('bookmanager')) {
          const match = s.textContent.match(/(https?:\/\/[^"'\s]*bookmanager[^"'\s]*)/);
          if (match) return { type: 'scriptMatch', url: match[1] };
        }
      }
      return null;
    });

    if (pageApiConfig) {
      logProgress(1, `Found page config: ${JSON.stringify(pageApiConfig).substring(0, 200)}`);
    }

    // Extract the shop ID and API base from intercepted requests
    if (!apiConfig) {
      logProgress(1, 'API not auto-detected via network. Trying direct API approach...');
      // BookManager typically uses this API pattern
      apiConfig = {
        baseUrl: 'https://api2.bookmanager.com',
        shopId: '7603827',
        fullUrl: `https://api2.bookmanager.com/tbm/shop/7603827/products`,
      };
    }

  } finally {
    await browser.close();
  }

  logProgress(1, `API discovery complete: ${JSON.stringify(apiConfig).substring(0, 200)}`);
  return apiConfig;
}
