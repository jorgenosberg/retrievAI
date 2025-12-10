# API Reference

## Interactive Documentation

Full interactive API documentation is available at:

- **Swagger UI**: [/api/docs](/api/docs)
- **ReDoc**: [/api/redoc](/api/redoc)

## Base URL

```
http://localhost:8000/api/v1
```

## Authentication

Most endpoints require authentication via JWT bearer token.

```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:8000/api/v1/documents
```

### Obtain Token

```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password"
}
```

## Endpoints Overview

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Obtain tokens |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Invalidate tokens |

### Documents

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/documents` | List documents |
| GET | `/documents/{id}` | Get document details |
| DELETE | `/documents/{id}` | Delete document |

### Upload

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/upload` | Upload document |
| GET | `/upload/{id}/status` | Check processing status |

### Chat

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/chat` | Send message |
| GET | `/chat/conversations` | List conversations |
| GET | `/chat/conversations/{id}` | Get conversation |
| DELETE | `/chat/conversations/{id}` | Delete conversation |

## Error Responses

Errors follow a consistent format:

```json
{
  "detail": "Error message here"
}
```

Common status codes:

| Code | Meaning |
|------|---------|
| 400 | Bad request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not found |
| 422 | Validation error |
| 500 | Server error |
