# Configuration

## Environment Variables

RetrievAI is configured via environment variables. Copy `.env.example` to `.env` and customize as needed.

### Required

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | Your OpenAI API key ([get one here](https://platform.openai.com/api-keys)) |
| `SECRET_KEY` | JWT signing key (min 32 characters) |

Generate a secure secret key:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Database

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_USER` | `retrievai` | PostgreSQL username |
| `POSTGRES_PASSWORD` | — | PostgreSQL password |
| `POSTGRES_DB` | `retrievai` | PostgreSQL database name |

### Application

| Variable | Default | Description |
|----------|---------|-------------|
| `ENVIRONMENT` | `development` | Environment name (`development`, `test`, `production`) |
| `DEBUG` | `true` | Enable debug mode |

## Production Configuration

For production deployments, ensure:

1. `DEBUG=false`
2. `ENVIRONMENT=production`
3. `SECRET_KEY` is a strong, unique value
4. `POSTGRES_PASSWORD` is secure

See [Deployment Guide](../DEPLOYMENT.md) for full production setup.
