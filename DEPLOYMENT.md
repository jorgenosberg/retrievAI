# RetrievAI Deployment Guide

Complete guide for deploying RetrievAI v0.2.0 to your OpenStack VM using GitHub Actions.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Setup Instructions](#setup-instructions)
- [GitHub Configuration](#github-configuration)
- [Deployment](#deployment)
- [Post-Deployment](#post-deployment)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### On Your VM

1. **Operating System**: Ubuntu 20.04+
2. **Software**: Docker, Docker Compose, Git, NGINX
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo apt install git nginx -y
   curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh
   sudo usermod -aG docker $USER
   ```
3. **Firewall**: Allow ports 80, 443, 22.
4. **ChromaDB Data**: Ensure your Chroma collection is present on the VM.
   - Default expected path: `/srv/retrievai-data/chromadb`
   - If different, set `CHROMA_DB_PATH` in your `.bashrc` or update the docker-compose file.

### On Your Local Machine

1. GitHub repository access.
2. OpenAI API key.

---

## Setup Instructions

### Step 1: Prepare VM Directories

```bash
# Create deployment directory
sudo mkdir -p /srv/retrievai
sudo chown $USER:$USER /srv/retrievai

# Create data directory (if not already existing)
sudo mkdir -p /srv/retrievai-data/chromadb
sudo chown -R $USER:$USER /srv/retrievai-data
```

### Step 2: Configure NGINX

The deployment workflow will copy the `nginx.conf` to the VM and substitute `${DOMAIN_NAME}` with your configured GitHub Variable.

```bash
# 1. Link the new configuration
sudo ln -sf /srv/retrievai/nginx.conf /etc/nginx/sites-available/retrievai
sudo ln -sf /etc/nginx/sites-available/retrievai /etc/nginx/sites-enabled/retrievai

# 2. Remove/Disable old configs (e.g., your existing 'streamlit' config)
sudo rm /etc/nginx/sites-enabled/default
sudo rm /etc/nginx/sites-enabled/streamlit  # If this is your old config name

# 3. Test and Reload
sudo nginx -t
sudo systemctl reload nginx
```

**Note**: The new `nginx.conf` is configured to use the domain defined in your GitHub Variables (`DOMAIN_NAME`).

---

## GitHub Configuration

### Secrets (Settings → Secrets and variables → Actions → Secrets)

Required secrets for the deployment workflow:

| Secret Name | Description |
|-------------|-------------|
| `SSH_HOST` | IP/IPv6 of your VM (e.g., `2001:700:2:8200::2232`) |
| `SSH_USER` | VM username (e.g., `ubuntu`) |
| `SSH_PROXY_HOST` | Jump host hostname (e.g., `login.uio.no`) |
| `SSH_PROXY_USER` | Jump host username (e.g., `jorgenao`) |
| `SSH_KEY` | Private SSH key (used for BOTH jump and target) |
| `OPENAI_API_KEY` | Your OpenAI API Key |
| `POSTGRES_PASSWORD` | Secure password for the database |
| `SECRET_KEY` | Secure random string for the app |

### Variables (Settings → Secrets and variables → Actions → Variables)

| Variable Name | Value |
|---------------|-------|
| `DEPLOY_PATH` | `/srv/retrievai` |
| `DOMAIN_NAME` | `yourdomain.com` |

---

## Deployment

### Automated Deployment

1. Go to **Actions** tab in GitHub.
2. Select **Deploy to OpenStack VM**.
3. Click **Run workflow**.
4. Select `production` environment.

The workflow will:
- SSH into the VM.
- Pull the latest code.
- Inject secrets into a `.env` file.
- Update NGINX config.
- Deploy with Docker Compose.
- Run database migrations.

### Manual Deployment (Fallback)

```bash
ssh user@vm
cd /srv/retrievai
git pull
# Manually create .env file with secrets
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Post-Deployment

### Verify Health

- **Frontend**: `https://yourdomain.com`
- **API**: `https://yourdomain.com/api/health`
- **Docs**: `https://yourdomain.com/docs`

### Data Migration

If you have existing data to migrate:

```bash
### Option A: Migration Scripts (Recommended if starting fresh)

```bash
# Copy migration data to VM
scp -r .retrievai/ your-user@your-vm:/srv/retrievai-data/

# Run migrations
cd /srv/retrievai
docker compose -f docker-compose.prod.yml run --rm \
  -v /srv/retrievai-data/.retrievai:/app/.retrievai \
  backend python /app/migration_scripts/migrate_users.py

docker compose -f docker-compose.prod.yml run --rm \
  -v /srv/retrievai-data/.retrievai:/app/.retrievai \
  backend python /app/migration_scripts/migrate_settings.py

docker compose -f docker-compose.prod.yml run --rm \
  -v /srv/retrievai-data/.retrievai:/app/.retrievai \
  backend python /app/migration_scripts/populate_documents.py
```

### Option B: Database Dump & Restore (If you have a full local DB)

If you have a fully populated local database you want to clone:

1. **Dump Local Database**:
   ```bash
   # Run this on your LOCAL machine
   # We exclude owner/privileges to avoid conflicts with production credentials
   docker compose exec postgres pg_dump -U retrievai -d retrievai --no-owner --no-acl > retrievai_dump.sql
   ```

2. **Transfer Dump to VM**:
   ```bash
   scp retrievai_dump.sql your-user@your-vm:/srv/retrievai/
   ```

3. **Restore on VM**:
   ```bash
   # SSH into VM
   ssh your-user@your-vm
   cd /srv/retrievai

   # Stop backend to prevent writes during restore
   docker compose -f docker-compose.prod.yml stop backend worker

   # Drop existing schema (optional, but safer for clean restore)
   docker compose -f docker-compose.prod.yml exec postgres psql -U retrievai -d retrievai -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

   # Restore the dump
   # Note: We use -d retrievai to connect to the correct DB
   cat retrievai_dump.sql | docker compose -f docker-compose.prod.yml exec -T postgres psql -U retrievai -d retrievai

   # Restart services
   docker compose -f docker-compose.prod.yml start backend worker
   ```
```

---

## Troubleshooting

- **ChromaDB Error**: Check if the volume mount path in `docker-compose.prod.yml` matches your VM path.
- **Database Error**: Check `POSTGRES_PASSWORD` in secrets.
- **NGINX Error**: Run `sudo nginx -t` to validate config.
```
