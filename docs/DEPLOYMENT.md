# Deployment

The store runs on **one Linux server (VPS)** with Docker. Everything is in [`deploy/`](../deploy):

| Service | What it does |
| --- | --- |
| `caddy` | Web server. Gets and renews free HTTPS certificates (Let's Encrypt) and routes the three addresses below. Also serves uploaded product images from `/media`. |
| `web` | Storefront → `https://www.seshastone.com` (the bare `seshastone.com` redirects here) |
| `admin` | Admin panel → `https://admin.seshastone.com` |
| `api` | API → `https://api.seshastone.com`. Applies database migrations automatically every time it starts. |
| `postgres` | Database: orders, payments, customers, products, settings |
| `redis` | Cache (safe to lose) |
| `meilisearch` | Product search (the catalogue falls back to database search if it is down) |

Images uploaded in the admin panel are stored on the server's disk (`STORAGE_DRIVER=local`) and included in the backups. The API can also use S3 or Cloudflare R2 instead (`STORAGE_DRIVER=s3` with the `S3_*` variables) if you outgrow one server.

## Preview on your computer

Before buying a domain or server, you can run the complete store on your own computer, the same way it will run on the server, and review everything: the storefront, checkout, the admin panel and photo uploads. Nothing is visible to anyone else, and nothing needs to be bought.

You need a computer with **at least 8 GB of RAM and 15 GB of free disk space**.

### 1. Install two programs (once)

- **Docker Desktop**: https://www.docker.com/products/docker-desktop/. On Windows, accept the "WSL 2" option during installation and restart when asked. Open Docker Desktop once and wait until it says it is running.
- **Git**: https://git-scm.com/downloads. On Windows this also installs **Git Bash**, the terminal to use for the commands below. On a Mac, use the Terminal app.

### 2. Download the store

Open Git Bash (Windows) or Terminal (Mac) and run:

```bash
git clone https://github.com/durv1590/SeShaStone.git
cd SeShaStone/deploy
./preview.sh start
```

The first `./preview.sh start` creates the settings file `deploy/.env` and prints your **first admin password**. Save it.

### 3. Fill in your details

Open `deploy/.env` in a text editor (on Windows: `notepad .env`; on a Mac: `open -e .env`) and fill in the `SEED_*` lines: store email and phone, `SEED_UPI_ID` (the UPI ID in your QR code), payee name, bank details and `SEED_GRIEVANCE_OFFICER_NAME`. Save the file. These are read once, when the store is first set up; after that, change them in **Admin → Settings**.

### 4. Start the store

```bash
./preview.sh start
```

The first start builds everything and takes 10–20 minutes; later starts take under a minute. When it finishes, open:

- **Storefront:** http://localhost:3000. The preview includes two demo products: a ruby ring and a necklace set with placeholder pictures.
- **Admin panel:** http://localhost:3001. Sign in with `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` from `.env`.

Try a full order: place it with UPI, enter any 12-digit UTR, then verify the payment in **Admin → Payments**. Add real products and photos in **Admin → Products** to see them on the storefront. Emails are skipped unless you fill in the `SMTP_*` lines.

### 5. Stop, restart or start over

```bash
./preview.sh stop     # stop; everything you added is kept
./preview.sh start    # start again
./preview.sh reset    # delete all preview data and start from scratch next time
./preview.sh logs     # show the API log if something looks wrong
```

When you're happy, follow the steps below to put the store on a real server. The server starts with a fresh database, so products you add in the preview stay on your computer; re-enter them on the live store, which also ensures no demo data goes live.

## What you need

- **A domain**: `seshastone.com`, from any registrar (GoDaddy, Hostinger, Namecheap, Cloudflare…). About ₹800–1,200 a year.
- **A VPS** with Ubuntu 24.04, **at least 2 vCPU, 4 GB RAM and 50 GB disk**, ideally in India (Mumbai or Bangalore) for fast pages. Examples: Hostinger KVM 2, DigitalOcean (BLR1), AWS Lightsail (Mumbai). About ₹800–1,500 a month.
- The `.env` values: Gmail app password (see **Email** below), your store, UPI and bank details.

## First deployment

### 1. Buy the domain

Buy `seshastone.com`. Turn on the registrar's auto-renew so the store never goes offline because the domain lapsed.

### 2. Rent the server

Create the VPS with **Ubuntu 24.04**. Add your SSH key during setup if the provider offers it; otherwise note the root password it gives you. Write down the server's **public IPv4 address**.

### 3. Point the domain at the server

In your registrar's DNS settings, add four **A records**, each pointing to the server's IPv4 address:

| Type | Name | Value |
| --- | --- | --- |
| A | `@` | your server IP |
| A | `www` | your server IP |
| A | `admin` | your server IP |
| A | `api` | your server IP |

Delete any existing "parking" A or CNAME records for those names. DNS changes usually apply within an hour. Check with `ping www.seshastone.com`: it should show your server's IP.

### 4. Prepare the server

Connect with `ssh root@YOUR_SERVER_IP`, then run:

```bash
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh            # Docker and Docker Compose
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw allow 443/udp && ufw --force enable
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile \
  && echo '/swapfile none swap sw 0 0' >> /etc/fstab   # extra memory for building the apps
```

### 5. Get the code and create the settings file

```bash
git clone https://github.com/durv1590/SeShaStone.git /opt/seshastone
cd /opt/seshastone/deploy
./init.sh
```

`init.sh` creates `deploy/.env` with new random secrets and prints the **first admin password**. Save it in a password manager.

Now edit `.env` (`nano .env`) and fill in:

- `ACME_EMAIL`: your email, for certificate notices.
- `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`: Gmail, see **Email** below. You can leave these empty and add them later; emails are then recorded as skipped.
- `SEED_STORE_*`, `SEED_GRIEVANCE_OFFICER_NAME`: shown on the contact and policy pages.
- `SEED_UPI_*`, `SEED_BANK_*`: your payment details. `SEED_UPI_ID` must match the UPI QR in `public/payment/upi-qr/current-upi-qr.png`.

`.env` holds every secret for the store: it is never committed to git. Keep a copy in your password manager.

### 6. Start the store

```bash
docker compose up -d --build          # first build takes 5–10 minutes
docker compose ps                     # all services should be "running", api "healthy"
docker compose exec api npm run prisma:seed
```

The seed runs once. It creates the admin login, categories, collections and policy pages, imports and verifies the original UPI QR, and fills Admin → Settings from your `.env`. Running it again never overwrites anything you have changed in the admin panel.

### 7. Check it works

- `https://www.seshastone.com` shows the storefront with a padlock (HTTPS). Certificates can take a minute after the first start.
- `https://admin.seshastone.com`: sign in with `SEED_ADMIN_EMAIL` and the password from step 5.
- **Admin → Settings**: check the business, payment and UPI QR sections. **Settings → Email → Send test email**.
- Place a small test order and pay ₹1 by UPI; verify it in **Admin → Payments**.

### 8. Turn on daily backups

```bash
crontab -e
# add this line: every night at 02:30
30 2 * * * /opt/seshastone/deploy/backup.sh >> /var/log/seshastone-backup.log 2>&1
```

Then work through [GO_LIVE_CHECKLIST.md](GO_LIVE_CHECKLIST.md).

## Email (Gmail)

The store sends order, payment, shipping and refund emails through Gmail's SMTP server, using a Google **app password**. An app password is a separate 16-character password that only lets the store send mail; it is not your Gmail password, and you can revoke it at any time.

1. Sign in to the Gmail account the store will send from.
2. Turn on **2-Step Verification** at https://myaccount.google.com/security (Google only offers app passwords when it is on).
3. Open https://myaccount.google.com/apppasswords, enter a name such as "SeSha Stone store", and choose **Create**. Copy the 16-character password Google shows. You will not be able to see it again.
4. On the server, set these in `deploy/.env`, then restart the API with `docker compose up -d api` (from the `deploy` folder):

   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=<the Gmail address>
   SMTP_PASS=<the 16-character app password, without spaces>
   SMTP_FROM="SeSha Stone <the same Gmail address>"
   ```

5. Check the API log (`docker compose logs api | grep Email`) for `Email ready: sending through smtp.gmail.com`. If it says `Email login failed`, the address or app password is wrong.
6. In **Admin → Settings → Email**, choose **Send test email** and confirm it arrives (check the spam folder the first time).

Good to know:

- `SMTP_FROM` must be the same Gmail address as `SMTP_USER`. Gmail replaces any other sender address with the account's own, and the admin Email panel warns if they differ.
- Gmail allows about 500 emails a day from a personal account, which is enough for a new store. Moving to a provider that sends from `@seshastone.com` (such as Brevo, Zoho or Amazon SES) later only means changing these variables.
- Changing your Google password revokes app passwords, so create a new one and update `SMTP_PASS` if that happens.
- The app password is a secret: never commit it to git or paste it into chat or email.

## Updating the store

When new code is merged into `main` on GitHub:

```bash
cd /opt/seshastone/deploy && ./update.sh
```

`update.sh` takes a backup, pulls the code, rebuilds and restarts the apps. Database migrations run automatically when the API starts. The storefront is briefly unavailable (usually under a minute) while containers restart, so update at a quiet time.

Rules that keep orders and payments safe:

- Migrations are additive and committed. Production only ever runs **`prisma migrate deploy`** (done automatically), never `migrate dev` or `db push`.
- Before an update whose migration drops or rewrites data, check the latest backup exists. Review the SQL in the PR.
- Orders, payments, refunds and audit logs are never deleted by the application.

## Backups

`deploy/backup.sh` writes two files to `deploy/backups/` and keeps 14 days:

- `db-YYYYMMDD-HHMM.sql.gz`: the full database.
- `media-YYYYMMDD-HHMM.tar.gz`: all uploaded images.

**A backup on the same server does not survive losing the server.** Copy them off regularly, for example weekly to your own computer:

```bash
scp -r root@YOUR_SERVER_IP:/opt/seshastone/deploy/backups ./seshastone-backups
```

Also turn on your VPS provider's automatic snapshots if offered (usually about 20% of the server price).

To restore the database from a backup (this replaces the current data):

```bash
cd /opt/seshastone/deploy
gunzip -c backups/db-YYYYMMDD-HHMM.sql.gz | docker compose exec -T postgres psql -U seshastone -d seshastone
```

To restore images: `docker compose run --rm --no-deps --user root -v "$(pwd)/backups:/backups" --entrypoint sh api -c "tar -xzf /backups/media-YYYYMMDD-HHMM.tar.gz -C /data/media"`.

## Logs and monitoring

- Logs: `docker compose logs -f api` (or `web`, `admin`, `caddy`). Logs are rotated automatically. Payment secrets, tokens and bank details are never logged.
- Status: `docker compose ps`. Every service restarts automatically after a crash or server reboot.
- Uptime check: point a free monitor (UptimeRobot, Better Stack) at `https://api.seshastone.com/api/v1/health` and `https://www.seshastone.com`.
- Disk space: `df -h`. Images and backups grow over time.
- Watch the admin dashboard daily for **payments to verify** and **pending refunds**.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Browser shows a certificate error | DNS not pointing at the server yet (`ping www.seshastone.com`), or ports 80/443 blocked. `docker compose logs caddy` shows the reason. |
| `api` not healthy | `docker compose logs api`. A wrong or missing value in `.env` is the usual cause. The API refuses to start with a weak `JWT_SECRET`. |
| Build fails with "killed" | The server ran out of memory: add the swap file from step 4. |
| Emails not arriving | Admin → Settings → Email shows the provider's exact error. |
| Changed `.env` but nothing happened | Run `docker compose up -d` again. Changes to `DOMAIN` need `docker compose up -d --build`. |

