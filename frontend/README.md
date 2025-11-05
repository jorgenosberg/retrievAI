# RetrievAI Frontend

Modern React frontend for RetrievAI built with:
- ⚡ Vite
- ⚛️ React 18 + TypeScript
- 🛣️ TanStack Router (file-based routing)
- 🔄 TanStack Query (server state)
- 🎨 Tailwind CSS v4
- 📝 React Hook Form + Zod validation

## Development

```bash
# Install dependencies
npm install

# Start dev server (with proxy to backend)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Docker

```bash
# Build image
docker build -t retrievai-frontend .

# Run container
docker run -p 3000:80 retrievai-frontend
```

## Project Structure

```
src/
├── routes/          # File-based routes (TanStack Router)
│   ├── __root.tsx         # Root layout
│   ├── index.tsx          # Home (redirects to /chat)
│   ├── login.tsx          # Login page
│   ├── register.tsx       # Register page
│   ├── _authenticated.tsx # Auth layout
│   ├── _authenticated.chat.tsx
│   ├── _authenticated.documents.tsx
│   └── _authenticated.settings.tsx
├── lib/             # Utilities
│   └── api.ts             # API client (axios)
├── components/      # Reusable components
├── index.css        # Tailwind imports
└── main.tsx         # App entry point
```

## Features

- ✅ JWT authentication with auto-redirect
- ✅ Protected routes
- ✅ Form validation with Zod
- ✅ API client with interceptors
- ✅ Responsive design
- 🚧 SSE streaming chat (coming soon)
- 🚧 Document upload with progress
- 🚧 Admin panel

## Environment Variables

Vite automatically proxies `/api` requests to `http://localhost:8000` in development.

For production, configure `VITE_API_URL` if needed.

## Backend Integration

The frontend expects the backend API to be running at `http://localhost:8000` with the following endpoints:

- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/auth/me` - Get current user
- `POST /api/v1/chat` - SSE streaming chat
- `GET /api/v1/documents` - List documents
- `POST /api/v1/upload` - Upload document
- `GET /api/v1/settings` - Get settings
- `PUT /api/v1/settings` - Update settings

See `src/lib/api.ts` for the complete API client implementation.
