# Deploying the Teacher Preview Site (Ubuntu 24 + NGINX + PM2)

This is a sibling deployment to the main Book Picker site documented in
`docs/deploy-digitalocean.md`. It runs a second Express process on a different
port, serves a different client bundle (`client/dist-preview`), and a different
dataset (`data/books-invoice.json` + `data/images-invoice/`). It is **public** —
no HTTP basic auth — so teachers can open the link without credentials.

The main student-facing site is completely unaffected by this deployment.

## Prerequisites

- Existing droplet already running the main Book Picker site per
  `deploy-digitalocean.md`
- PM2 and NGINX already installed
- A domain or subdomain pointed at the droplet
  (e.g. `preview-books.example.com`)

## 1. Build both bundles locally

```bash
npm run build            # -> client/dist/
npm run build:preview    # -> client/dist-preview/
```

## 2. Generate the invoice dataset

```bash
npm run scrape:invoice   # -> data/books-invoice.json + data/images-invoice/
```

This can take 5–15 minutes depending on how many ISBNs need scraping. It's
resumable — re-run if interrupted.

The ISBN source list lives at `scraper/invoice-isbns.json`. Edit that file
when a new invoice arrives, then re-run the scraper.

## 3. Transfer to the droplet

The main app lives at `/var/www/book-picker` on the droplet (per the main
doc). The preview deployment reuses the same checkout — it just runs a
second PM2 process pointed at different env vars, so there's no second git
clone.

From your local machine, rsync the preview build and the invoice data:

```bash
rsync -avz client/dist-preview/ \
  user@droplet:/var/www/book-picker/client/dist-preview/
rsync -avz data/books-invoice.json \
  user@droplet:/var/www/book-picker/data/books-invoice.json
rsync -avz data/images-invoice/ \
  user@droplet:/var/www/book-picker/data/images-invoice/
```

If you prefer isolated deployments, clone the repo a second time to
`/var/www/book-picker-preview` and follow the main doc's install steps
there. The instructions below assume the shared-checkout approach.

## 4. Start the preview process with PM2

The preview process needs three env vars:

- `PORT=3001` — different from the main site's 3000
- `BOOKS_FILE=books-invoice.json` — tells the server which JSON to load
- `CLIENT_DIST=client/dist-preview` — tells the server which built client
  to serve

Start it with PM2:

```bash
cd /var/www/book-picker
PORT=3001 BOOKS_FILE=books-invoice.json CLIENT_DIST=client/dist-preview \
  pm2 start server/index.mjs --name book-picker-preview
pm2 save
```

Verify:

```bash
curl http://localhost:3001/api/health
# {"status":"ok","booksFile":"books-invoice.json"}
```

Note: the preview process writes to the same SQLite file as the main app.
This is harmless — the preview site never calls any admin or selections
endpoint. If you want total isolation, set `DATA_DIR` to a separate
directory and copy the data files there.

## 5. NGINX server block

Create `/etc/nginx/sites-available/book-picker-preview`:

```nginx
server {
    listen 80;
    server_name preview-books.example.com;

    # No auth_basic — this site is intentionally public

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/book-picker-preview \
  /etc/nginx/sites-enabled/
sudo nginx -t && sudo nginx -s reload
```

## 6. HTTPS with Certbot

```bash
sudo certbot --nginx -d preview-books.example.com
```

## 7. Smoke test

From your laptop:

```bash
curl -sI https://preview-books.example.com/ | head -1
# HTTP/2 200
curl -s https://preview-books.example.com/api/books | head -c 200
```

Then open `https://preview-books.example.com/` in a browser and verify:

1. Loads directly on the browsing grid (no teacher setup screen)
2. Shows the invoice books
3. No "picked" counter, no pick buttons, no done button
4. Book preview dialog still opens and flips pages

## Updating the preview site after a new invoice

```bash
# Locally:
# 1. Edit scraper/invoice-isbns.json with the new ISBNs
# 2. Re-scrape
npm run scrape:invoice
# 3. Rebuild only if client code changed
npm run build:preview

# Transfer:
rsync -avz data/books-invoice.json \
  user@droplet:/var/www/book-picker/data/
rsync -avz data/images-invoice/ \
  user@droplet:/var/www/book-picker/data/images-invoice/
# Only if rebuilt:
rsync -avz client/dist-preview/ \
  user@droplet:/var/www/book-picker/client/dist-preview/

# On the droplet:
pm2 restart book-picker-preview
```

## Useful PM2 commands

```bash
pm2 status
pm2 logs book-picker-preview
pm2 restart book-picker-preview
pm2 stop book-picker-preview
pm2 delete book-picker-preview    # remove entirely
```
