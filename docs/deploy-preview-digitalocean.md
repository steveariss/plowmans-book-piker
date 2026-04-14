# Deploying the Teacher Preview Site (Ubuntu 24 + NGINX + PM2)

This is a sibling deployment to the main Book Picker site documented in
`docs/deploy-digitalocean.md`. It runs a second Express process on a different
port, serves a different client bundle (`client/dist-preview`), and a different
dataset (`data/books-invoice.json` + `data/images-invoice/`). It is **public** —
no HTTP basic auth — so teachers can open the link without credentials.

The main student-facing site is completely unaffected by this deployment.

- **Domain:** `new-book-preview.i-made-a-thing.com`
- **Droplet path:** `~/new-book-preview` (your home directory on the droplet)
- **Express port:** `3001` (the main site uses `3000`)
- **PM2 process name:** `book-picker-preview`

## Prerequisites

- Existing droplet already running the main Book Picker site per
  `deploy-digitalocean.md`
- PM2 and NGINX already installed
- DNS A record for `new-book-preview.i-made-a-thing.com` pointing at the droplet
- `cwebp` installed locally for the scraper (`brew install webp` on macOS)

## 1. Clone the repo on the droplet

The preview deployment is its own checkout in your home directory, separate
from the main site at `/var/www/book-picker`.

```bash
ssh user@your-droplet
cd ~
git clone <your-repo-url> new-book-preview
cd new-book-preview
git checkout teacher-preview   # or main once merged

# Install all dependencies
npm install
cd client && npm install && cd ..
cd server && npm install && cd ..
```

## 2. Generate the invoice dataset locally

The scraper needs `cwebp` (libwebp), which is easier to install on your laptop
than on the droplet. Run it locally, then rsync the result.

```bash
# On your laptop, in the project directory:
npm run scrape:invoice
```

This produces `data/books-invoice.json` + `data/images-invoice/`. It can take
5–15 minutes and is resumable — re-run if interrupted.

The ISBN source list lives at `scraper/invoice-isbns.json`. Edit that file
when a new invoice arrives, then re-run the scraper.

The scraper runs four phases automatically:

1. **Detail Fetch** — pulls book metadata + interior image keys from the
   BookManager API
2. **Image Download** — downloads cover + interior pages from the BookManager
   CDN and converts to webp
3. **JSON generation** — writes `data/books-invoice.json`
4. **Cover Upgrade** — for any cover under 300px wide (BookManager serves
   thumbnail-only data for a handful of titles), tries Open Library then
   Google Books for a higher-resolution replacement. Wrapped in error handling
   so a third-party outage can never fail the main scrape; if both sources are
   unavailable the existing covers stay in place.

## 3. Transfer scraped data + build the client on the droplet

Send the scraped data to the droplet's preview checkout:

```bash
# From your laptop:
rsync -avz data/books-invoice.json \
  user@your-droplet:~/new-book-preview/data/books-invoice.json
rsync -avz data/images-invoice/ \
  user@your-droplet:~/new-book-preview/data/images-invoice/
```

Build the preview bundle on the droplet:

```bash
# On the droplet:
cd ~/new-book-preview
npm run build:preview     # -> client/dist-preview/
```

## 4. Start the preview process with PM2

The preview process needs three env vars:

- `PORT=3001`
- `BOOKS_FILE=books-invoice.json`
- `CLIENT_DIST=client/dist-preview`

```bash
cd ~/new-book-preview
PORT=3001 BOOKS_FILE=books-invoice.json CLIENT_DIST=client/dist-preview \
  pm2 start server/index.mjs --name book-picker-preview
pm2 save
```

Verify it's running:

```bash
curl http://localhost:3001/api/health
# {"status":"ok","booksFile":"books-invoice.json"}

curl -s http://localhost:3001/api/books | head -c 100
```

## 5. NGINX server block

Create `/etc/nginx/sites-available/new-book-preview`:

```nginx
server {
    listen 80;
    server_name new-book-preview.i-made-a-thing.com;

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
sudo ln -s /etc/nginx/sites-available/new-book-preview \
  /etc/nginx/sites-enabled/
sudo nginx -t && sudo nginx -s reload
```

## 6. HTTPS with Certbot

```bash
sudo certbot --nginx -d new-book-preview.i-made-a-thing.com
```

## 7. Smoke test

From your laptop:

```bash
curl -sI https://new-book-preview.i-made-a-thing.com/ | head -1
# HTTP/2 200
curl -s https://new-book-preview.i-made-a-thing.com/api/books | head -c 200
```

Then open `https://new-book-preview.i-made-a-thing.com/` in a browser and
verify:

1. Loads directly on the browsing grid (no teacher setup screen)
2. Shows the invoice books
3. No "picked" counter, no pick buttons, no done button
4. Book preview dialog still opens and flips pages
5. Books with interior previews show the orange "Look Inside!" badge

## Updating the preview site after a new invoice

```bash
# 1. Locally: edit scraper/invoice-isbns.json with the new ISBNs
# 2. Locally: re-scrape
npm run scrape:invoice

# 3. Locally: transfer the new data
rsync -avz data/books-invoice.json \
  user@your-droplet:~/new-book-preview/data/books-invoice.json
rsync -avz data/images-invoice/ \
  user@your-droplet:~/new-book-preview/data/images-invoice/

# 4. On the droplet: pull any code changes and rebuild
ssh user@your-droplet
cd ~/new-book-preview
git pull
npm install                          # only if package.json changed
cd client && npm install && cd ..    # only if client/package.json changed
npm run build:preview

# 5. On the droplet: restart
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
