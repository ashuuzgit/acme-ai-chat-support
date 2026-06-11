# AI Customer Support Platform

A multi-tenant SaaS platform that lets any business deploy a branded AI customer support chatbot trained on their own knowledge base. Built for the Magentic AI engineering assessment.

---

## Live URLs

| Service | URL |
|---------|-----|
| Frontend | `[your Vercel URL]` |
| Backend | `[your Railway URL]` |

---

## Demo Credentials

| Field | Value |
|-------|-------|
| Email | admin@demo.com |
| Password | demo123456 |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Node.js, Express, TypeScript |
| Database | Supabase (PostgreSQL) |
| File Storage | Supabase Storage |
| Search | PostgreSQL Full-Text Search (tsvector) |
| AI / LLM | Groq API — llama-3.3-70b-versatile |
| Auth | JWT (HS256, 7-day expiry) + bcrypt |
| Streaming | Server-Sent Events (SSE) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Customer Browser                        │
│              (Embeddable Widget  /  Admin Dashboard)            │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js Frontend (Vercel)                     │
│   /dashboard  /tickets  /conversations  /analytics              │
│   /widget/[businessId]  — embeddable chat widget page           │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST + SSE
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Express Backend (Railway)                      │
│                                                                 │
│  POST /api/chat ──► RAG search ──► Build system prompt          │
│                         │                   │                   │
│                    Supabase DB          Groq API                │
│                  (chunks table,      llama-3.3-70b              │
│                  FTS tsvector)       SSE stream                  │
│                                                                 │
│  POST /api/documents/upload ──► parse ──► chunk ──► DB          │
│  GET  /api/analytics/*  ──► parallel Supabase queries           │
└───────────┬───────────────────────────────────┬─────────────────┘
            │                                   │
            ▼                                   ▼
┌────────────────────────┐         ┌────────────────────────────┐
│   Supabase PostgreSQL  │         │      Supabase Storage      │
│                        │         │                            │
│  businesses            │         │  documents/               │
│  users                 │         │  └─ {businessId}/         │
│  ai_configs            │         │     └─ {uuid}-file.pdf    │
│  documents             │         └────────────────────────────┘
│  chunks (+ tsvector)   │
│  conversations         │
│  messages              │
│  tickets               │
└────────────────────────┘
```

**Request flow for a customer chat message:**
1. Widget POSTs message + businessId to `/api/chat`
2. Backend fetches `ai_configs` for the business (bot name, personality, escalation rules)
3. FTS search on `chunks` table → ILIKE fallback if no results
4. System prompt assembled: personality template + knowledge base context
5. Groq streams response tokens → forwarded to browser via SSE
6. After stream: response saved, escalation detection runs, ticket created if triggered
7. `{ done: true, conversationId }` sent as final SSE event

---

## Local Setup

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)
- A [Groq](https://console.groq.com) API key (free tier works)

---

### Backend

```bash
cd backend
cp .env.example .env
# Fill in SUPABASE_URL, SUPABASE_SERVICE_KEY, GROQ_API_KEY, JWT_SECRET
npm install
npm run dev
# Server starts on http://localhost:5000
```

**Required env vars:**

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Service role key (Settings → API in Supabase dashboard) |
| `GROQ_API_KEY` | From console.groq.com |
| `JWT_SECRET` | Any random 32+ character string |
| `CORS_ORIGIN` | Frontend URL (default: `http://localhost:3000`) |
| `PORT` | Server port (default: `5000`) |

---

### Frontend

```bash
cd frontend
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL to your backend URL
npm install
npm run dev
# App starts on http://localhost:3000
```

**Required env vars:**

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend URL e.g. `http://localhost:5000` |
| `NEXT_PUBLIC_APP_URL` | Frontend URL e.g. `http://localhost:3000` (used for widget embed script) |

---

### Database Setup

Run these SQL statements in your Supabase SQL editor to create the schema:

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Businesses
create table businesses (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text unique not null,
  created_at timestamptz default now()
);

-- Users
create table users (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  email text unique not null,
  password_hash text not null,
  role text not null default 'admin',
  created_at timestamptz default now()
);

-- AI Configs
create table ai_configs (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid unique references businesses(id) on delete cascade,
  bot_name text default 'SupportBot',
  welcome_message text default 'Hi! How can I help you today?',
  personality text default 'professional',
  escalation_rules text[] default '{}'
);

-- Documents
create table documents (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  name text not null,
  file_type text not null,
  storage_path text not null,
  status text default 'processing',
  created_at timestamptz default now()
);

-- Chunks with FTS
create table chunks (
  id uuid primary key default uuid_generate_v4(),
  document_id uuid references documents(id) on delete cascade,
  business_id uuid references businesses(id) on delete cascade,
  content text not null,
  chunk_index int,
  search_vector tsvector generated always as (to_tsvector('english', content)) stored
);
create index chunks_search_vector_idx on chunks using gin(search_vector);

-- Conversations
create table conversations (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  customer_name text,
  customer_email text,
  status text default 'active',
  created_at timestamptz default now()
);

-- Messages
create table messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid references conversations(id) on delete cascade,
  role text not null,
  content text not null,
  event_type text default 'message',
  response_time_ms int,
  created_at timestamptz default now()
);

-- Tickets
create table tickets (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete set null,
  customer_name text,
  customer_email text,
  query text not null,
  priority text default 'medium',
  status text default 'open',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

---

## Embedding the Widget

After registering, go to **AI Config** in the dashboard to get your `businessId`. Add this snippet to any website:

```html
<script
  src="https://your-vercel-url.vercel.app/api/widget-script"
  data-business-id="YOUR_BUSINESS_ID">
</script>
```

Or visit the widget directly at:
```
https://your-vercel-url.vercel.app/widget/YOUR_BUSINESS_ID
```

---

## Sample Knowledge Base

See [`/sample-data/faq.txt`](./sample-data/faq.txt) for a ready-to-upload FAQ document covering pricing, refunds, accounts, integrations, and billing for a fictional SaaS product (Acme Software). Upload it in the **Knowledge Base** section of the dashboard to test AI responses immediately.

---

## Deployment

### Backend → Railway

1. Create a new Railway project, connect this GitHub repo, set root directory to `/backend`
2. Add all env vars from `backend/.env.example`
3. Railway detects the `Procfile` (`web: npm start`) and runs `npm run build` automatically
4. Copy the generated Railway URL → set as `NEXT_PUBLIC_API_URL` in Vercel

### Frontend → Vercel

1. Import repo into Vercel, set root directory to `/frontend`
2. Add env vars: `NEXT_PUBLIC_API_URL` (Railway URL) and `NEXT_PUBLIC_APP_URL` (Vercel URL)
3. Deploy — Vercel auto-detects Next.js

---

## Project Structure

```
ai-support-platform/
├── backend/
│   ├── src/
│   │   ├── index.ts                  # Express app, middleware, route registration
│   │   ├── db/supabase.ts            # Supabase client (service role)
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts    # JWT verification → req.user
│   │   │   └── error.middleware.ts   # Global error handler
│   │   ├── routes/
│   │   │   ├── auth.routes.ts        # Register, login, me
│   │   │   ├── chat.routes.ts        # SSE streaming chat endpoint
│   │   │   ├── documents.routes.ts   # Upload, list, delete, reindex
│   │   │   ├── tickets.routes.ts     # List, update status
│   │   │   ├── conversations.routes.ts
│   │   │   ├── config.routes.ts      # AI config CRUD
│   │   │   └── analytics.routes.ts   # Dashboard + overview + knowledge
│   │   └── services/
│   │       ├── rag.service.ts        # FTS + ILIKE retrieval, prompt builder
│   │       ├── document.service.ts   # Parse, chunk, store pipeline
│   │       ├── escalation.service.ts # Keyword-based priority detection
│   │       └── ticket.service.ts     # Ticket creation
│   ├── Procfile                      # web: npm start
│   ├── .env.example
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (dashboard)/          # Admin portal (requires auth)
│   │   │   │   ├── dashboard/        # Stats, live activity, charts
│   │   │   │   ├── tickets/          # Ticket list with filters + pagination
│   │   │   │   ├── conversations/    # Conversation threads
│   │   │   │   ├── knowledge-base/   # Document upload + management
│   │   │   │   ├── ai-config/        # Bot config + personality preview
│   │   │   │   └── analytics/        # Charts + knowledge base metrics
│   │   │   ├── widget/[businessId]/  # Public embeddable chat widget
│   │   │   └── api/widget-script/    # Returns embeddable JS snippet
│   │   └── lib/
│   │       ├── api.ts                # Axios instance with auth interceptor
│   │       └── auth.ts               # Auth helpers
│   ├── .env.example
│   └── next.config.mjs
├── sample-data/
│   └── faq.txt                       # Sample knowledge base (Acme Software FAQ)
└── README.md
```

---

## Expected Deliverables Checklist

- [ ] Live Application URL (fill in above after deploying)
- [x] GitHub Repository
- [x] README.md with setup instructions
- [x] Architecture diagram (ASCII, see above)
- [x] Sample Knowledge Base Data (`/sample-data/faq.txt`)
- [ ] Admin Credentials (register at `/register` or use demo account above)
- [ ] Repository access granted to dev@gomagentic.com
