# Adal Nexus — Pakistan Legal Community Platform

> Where the Legal Community Connects, Learns & Grows.

A free, open digital ecosystem for the **Pakistani legal community** — law students, advocates, judges, and legal professionals across all provinces, AJK, GB, and Islamabad.

See [`documents/PRD.md`](documents/PRD.md) and [`documents/SRS.md`](documents/SRS.md) for the full product brief.

## Stack (Firebase MVP)

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router) · TypeScript · Tailwind CSS · shadcn-style components |
| Backend | Python 3.11+ · FastAPI (Vercel serverless via `@vercel/python`) |
| Database | Firebase Firestore |
| Auth | Firebase Authentication (email/password + Google OAuth) |
| AI | Google Gemini via `google-generativeai` (raw SDK) |
| Hosting | Vercel (Next.js + Python serverless co-hosted) |

## Project layout

```
.
├── app/                  Next.js App Router (layout, landing page, globals.css)
├── api/                  Python FastAPI backend (main.py, requirements.txt)
├── components/ui/        shadcn-style UI primitives (Button, Card)
├── lib/                  Shared utilities (cn helper)
├── documents/            PRD.md, SRS.md, DEPLOYMENT_GUIDE.md
├── next.config.js        Dev rewrite: /api/* → http://127.0.0.1:8000
├── vercel.json           Hybrid build config (Next.js + Python)
├── tailwind.config.ts    Brand palette (navy + gold) + serif/sans fonts
└── .env.local.example    Copy to .env.local and fill in keys
```

## Setup

```bash
# 1. Clone and enter the repo
git clone <your-repo-url>
cd Adal_Nexus

# 2. Copy and fill environment variables
cp .env.local.example .env.local
# Add Firebase Web SDK vars, Firebase Admin vars, and GOOGLE_GENERATIVEAI_API_KEY

# 3. Install Node dependencies
npm install

# 4. Install Python dependencies
python3 -m venv .venv && source .venv/bin/activate
pip install -r api/requirements.txt
```

## Running locally

You need **two terminals**:

```bash
# Terminal 1 — Next.js (port 3000)
npm run dev

# Terminal 2 — FastAPI (port 8000)
source .venv/bin/activate
uvicorn api.main:app --reload --port 8000
```

Then open:

- Landing page → http://localhost:3000
- Health check → http://localhost:3000/api/health  *(proxied to FastAPI in development)*
- Version       → http://localhost:3000/api/version

## Deploying to Vercel

1. Push to GitHub.
2. Import the repo into Vercel.
3. Add environment variables in the Vercel dashboard (matching `.env.local.example`).
4. Push to `main` — Vercel builds Next.js and the FastAPI entrypoint (`vercel-build` runs `pip install -r api/requirements.txt && next build`).

## Notes

- The AI chatbot uses **Google Gemini directly**. The Pakistan-specific system prompt lives in the FastAPI chat router.
- Forum categories, AI tone, and roadmap content are Pakistan-specific and tuned for the MVP scope.

## Branch

This codebase is the Firebase MVP branch. The old PostgreSQL/NextAuth stack has been removed from runtime code.
