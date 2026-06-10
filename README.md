# AI Support Platform

A monorepo containing the frontend and backend for the AI Support Platform.

## Structure

```
ai-support-platform/
├── frontend/   # Next.js 14 app (TypeScript, Tailwind CSS, shadcn/ui)
└── backend/    # Express API (TypeScript)
```

## Getting Started

### Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
```

### Backend

```bash
cd backend
npm install
cp .env.example .env   # fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
npm run dev            # http://localhost:5000
```

## Environment Variables

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL (default: `http://localhost:5000`) |

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `PORT` | Server port (default: `5000`) |
| `CORS_ORIGIN` | Allowed frontend origin (default: `http://localhost:3000`) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |

## Routes (Frontend)

| Path | Description |
|---|---|
| `/login` | Login page |
| `/register` | Registration page |
| `/forgot-password` | Password reset page |
| `/dashboard` | Main dashboard |
| `/knowledge-base` | Knowledge base management |
| `/ai-config` | AI configuration |
| `/tickets` | Support tickets |
| `/conversations` | Conversations |
| `/analytics` | Analytics |
| `/widget/[businessId]` | Embeddable chat widget |
