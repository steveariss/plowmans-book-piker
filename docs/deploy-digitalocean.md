# Deploying to Digital Ocean (Ubuntu 24 + NGINX + PM2)

## Prerequisites

- Digital Ocean droplet running Ubuntu 24
- NGINX installed and running
- PM2 installed globally (`npm install -g pm2`)
- Node.js 20 LTS installed

## 1. Clone and Install

```bash
cd /var/www  # or wherever you keep sites
git clone <your-repo-url> book-picker
cd book-picker

# Install all dependencies + build client
npm install
cd client && npm install && npm run build && cd ..
cd server && npm install && cd ..
```

## 2. Transfer Data

The `data/` directory (books.json + images) is gitignored, so transfer it separately from your local machine:

```bash
rsync -avz ./data/ user@your-droplet:/var/www/book-picker/data/
```

## 3. Start with PM2

```bash
cd /var/www/book-picker
pm2 start server/index.mjs --name book-picker
pm2 save
```

The Express server listens on port 3000 by default and serves the built React client, images, and API.

## 4. NGINX Configuration

Create `/etc/nginx/sites-available/book-picker`:

```nginx
server {
    listen 80;
    server_name your-domain.com;  # or droplet IP

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site and reload:

```bash
sudo ln -s /etc/nginx/sites-available/book-picker /etc/nginx/sites-enabled/
sudo nginx -t && sudo nginx -s reload
```

## 5. SSL with Certbot (Optional)

If you have a domain pointed at the droplet:

```bash
sudo certbot --nginx -d your-domain.com
```

## Updating the App

```bash
cd /var/www/book-picker
git pull
cd client && npm install && npm run build && cd ..
cd server && npm install && cd ..
pm2 restart book-picker
```

## Useful PM2 Commands

```bash
pm2 status              # Check app status
pm2 logs book-picker    # View logs
pm2 restart book-picker # Restart after changes
pm2 stop book-picker    # Stop the app
```
