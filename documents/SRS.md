# Software Requirements Specification (SRS)
## Adal Nexus – Firebase MVP Edition

| Field | Details |
|-------|---------|
| **Version** | 1.3.0 – Firebase MVP |
| **Date** | May 2, 2026 |
| **Author** | Hackathon Dev Team |
| **Status** | Approved for Implementation |

> **Revision 1.3 note** — **Firebase Firestore MVP**. Replaces PostgreSQL with Firebase Firestore. Firebase Auth for user authentication. Python/FastAPI backend as Vercel serverless functions. Google Gemini API for AI chatbot. All v1.2 functional requirements mapped to Firestore schema.

---

## 1. Introduction

### 1.1 Purpose

Defines technical requirements for **Adal Nexus v1.3 (Firebase MVP)**, a full-stack platform for the Pakistani legal community using:
- **Frontend**: Next.js 14 (App Router, TypeScript)
- **Backend**: Python/FastAPI serverless on Vercel
- **Database**: Firebase Firestore (NoSQL)
- **Auth**: Firebase Authentication
- **AI**: Google Gemini API

### 1.2 Scope

**In Scope (MVP – P0):**
- User authentication via Firebase Auth
- Professional profiles (Firestore `users/{uid}`)
- Posts and feed (read/write via Firestore)
- 8-category forum with tags (Firestore `forumThreads`, `forumReplies`)
- AI chatbot (Student & Professional modes, Google Gemini backend)
- Year-wise roadmap with milestone tracking (Firestore `roadmapProgress`)
- Responsive UI; desktop-first MVP
- Vercel hybrid deployment

**Out of Scope (P1+):**
- Reputation scoring & leaderboards
- Global full-text search
- Notifications (in-app / email)
- Personal analytics
- Mobile app
- Mentorship booking
- Advanced content moderation

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|-----------|
| Firestore | Google Cloud Firestore – NoSQL database |
| Firebase Auth | Google's authentication service |
| Firebase Admin SDK | Server-side Firebase integration (Python) |
| Firebase Web SDK | Client-side Firebase integration (JavaScript) |
| Python/FastAPI | Backend API framework running as Vercel serverless functions |
| Google Gemini | AI model used for legal chatbot |
| PPC / CrPC | Pakistan Penal Code / Code of Criminal Procedure |
| PECA | Prevention of Electronic Crimes Act 2016 |
| FSC | Federal Shariat Court |
| P0 / P1 | MVP must-have / Post-MVP nice-to-have |

### 1.4 References

- PRD.md v1.3 (Firebase MVP)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Firebase Admin SDK for Python](https://firebase.google.com/docs/admin/setup)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Next.js 14 Documentation](https://nextjs.org/docs)
- [Google Generative AI Python SDK](https://github.com/google-ai-python/generative-ai)

---

## 2. Overall Description

### 2.1 System Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Frontend (Next.js 14 | TypeScript | Vercel CDN)         │
│ ├─ Landing page                                         │
│ ├─ Dashboard (sidebar + feed/forum/chat/roadmap)       │
│ ├─ Firebase Web SDK (auth + Firestore reads)           │
│ └─ HTTP calls to Python API for write/sensitive ops    │
└──────────────┬──────────────────────────────────────────┘
               │ (1) Firebase ID token in Authorization header
               │ (2) Direct Firestore reads (optional, for speed)
               ▼
┌──────────────────────────────────────────────────────────┐
│ Python Backend (FastAPI | Vercel Serverless)            │
│ ├─ /api/auth/me – Get current user profile             │
│ ├─ /api/profile/* – Read/write profiles                │
│ ├─ /api/posts/* – CRUD posts                           │
│ ├─ /api/forum/* – CRUD threads/replies                 │
│ ├─ /api/chat – Gemini integration                      │
│ ├─ /api/roadmap/* – Milestone progress                 │
│ ├─ Firebase Admin SDK (verify tokens, Firest

---

## 3. Functional Requirements

### 3.1 User Management & Authentication

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01 | Users shall register via email magic link or OAuth (Google, GitHub). | P0 |
| FR-02 | The frontend forwards a signed JWT to the Python API on every authenticated call. | P0 |
| FR-03 | Profile fields: name, email, user type, year (1–5 if student), specialisation(s), bio, photo, **experience**, **achievements**. A `country` field defaults to `"Pakistan"` (reserved for future localisation, P2). | P0 |
| FR-04 | Users shall delete their account (anonymise/remove personal data). | P1 |

### 3.2 Profiles, Knowledge Sharing & Reputation

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-05 | Users shall create posts (title, rich-text body, optional tags). | P0 |
| FR-06 | Users shall edit/delete their own posts. | P0 |
| FR-07 | Feed sorted by recency, filterable by user type (Students/Lawyers/Judges) and "Trending". | P0 |
| FR-08 | Users shall like/unlike and comment on posts. | P0 |
| FR-09 | Users shall save posts; saved items appear under "Saved Content". | P0 |
| FR-10 | Each user shall have a **reputation score** (int, default 0) shown on profile and bylines. | P0 |
| FR-11 | The system shall award reputation per the table below; every change creates a `reputation_events` row. | P0 |
| FR-12 | Reputation never goes below 0; deltas that would do so are clamped. | P0 |

**Reputation rules (FR-11):**

| Action | Delta | Trigger |
|--------|-------|---------|
| Publish a post | +5 | `posts.create` success |
| Post a forum reply | +2 | `forum_replies.create` success |
| Receive an upvote | +1 | `votes.create` (idempotent per voter+target) |
| Complete a milestone | +10 | `user_milestone_progress.create` (first time only) |

Reputation updates and the originating action are committed in a single DB transaction. Reversals (post deletion, vote retraction) emit a negative `reputation_event` of equal magnitude.

### 3.3 Community Forum (Pakistan-Specific)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-13 | Threads must be created under one of eight fixed categories: `PK_CONSTITUTIONAL`, `PK_CRIMINAL`, `CORPORATE_TAX`, `CIVIL`, `FAMILY_PERSONAL`, `CYBER_PECA`, `CAREER_BAR`, `LEGAL_AWARENESS`. | P0 |
| FR-14 | Threads accept one or more **domain tags**: `CONSTITUTION`, `PPC`, `CRPC`, `QANUN_E_SHAHADAT`, `CPC`, `SECP`, `FBR_TAX`, `PECA`, `FAMILY_LAWS`, `SERVICE_TRIBUNALS`, `FSC`, `SUPREME_COURT`, `HIGH_COURTS`, `OTHER`. | P0 |
| FR-15 | Guests shall view threads (read-only); only authenticated users post. | P0 |
| FR-16 | Authenticated users shall post replies. | P0 |
| FR-17 | Users shall upvote/downvote threads and replies (one vote per user per target; toggling allowed). | P0 |
| FR-18 | Tag chips clickable across the platform open a tag-filtered view. | P0 |

### 3.4 AI Legal Chatbot — Two Modes (Gemini)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-19 | Authenticated users shall interact with a chatbot that maintains conversation history per session. | P0 |
| FR-20 | The chatbot shall use **Google Gemini (`gemini-2.0-flash`)** via the `google-generativeai` Python SDK with a Pakistan-specific system prompt (see PRD Appendix A). | P0 |
| FR-21 | **No LangChain or LangGraph** dependencies are permitted; orchestration is direct API calls. | P0 |
| FR-22 | The chatbot shall expose a **mode selector**: **Student Mode** (simplified, career-focused) and **Professional Mode** (technical, doctrinal, citing Pakistani statutes/cases). | P0 |
| FR-23 | The selected mode is injected into the system prompt template (`{{MODE}}`) and stored on `chat_sessions.mode`; switchable mid-conversation. | P0 |
| FR-24 | Responses must reference Pakistani law where appropriate (Constitution of Pakistan 1973, PPC, CrPC, Qanun-e-Shahadat, CPC, PECA, etc.) and cite landmark Pakistani judgments when relevant. | P0 |
| FR-25 | Disclaimer shown before every chat: *"This AI does not provide legal advice. Consult a licensed Pakistani advocate for specific legal matters."* | P0 |
| FR-26 | Mode-specific suggested prompts displayed above the input (PRD Appendix A). | P0 |
| FR-27 | Rate limit: 50 messages/user/24h. | P1 |
| FR-28 | Users shall clear chat history. | P2 |

### 3.5 Year-Wise Roadmap – Enhanced UI

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-29 | Students shall see a "Roadmap" tab with a 4-year framework. The UI shall display a note: *"This framework adapts to 3-year and 5-year LL.B. programmes — progress is measured by milestones, not calendar years."* | P0 |
| FR-30 | Each year renders milestones as a **task checklist** (checkboxes). | P0 |
| FR-31 | Each year shows a **progress bar** (% milestones completed). | P0 |
| FR-32 | Marking a milestone complete persists progress, awards the badge (if any), and awards reputation per FR-11. | P0 |
| FR-33 | Earned **completion badges** appear on the user's profile and inline. | P0 |
| FR-34 | The system recommends the next milestone based on incomplete tasks. | P1 |

### 3.6 Search & Discovery (P1)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-35 | Topbar global search queries users, posts, threads, tags. | P1 |
| FR-36 | Filters: user type, recency, popularity, tag. | P1 |
| FR-37 | Tag chips navigate to a tag-filtered cross-content view. | P1 |
| FR-38 | MVP backend uses Postgres FTS (`tsvector` + GIN); Meilisearch is post-MVP. | P1 |

### 3.7 Dashboard Layout & Suggestions

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-39 | Dashboard renders left sidebar (Home Feed, My Profile, AI Chatbot, Roadmap, Communities, Saved Content). | P0 |
| FR-40 | Main column shows feed with filter chips: Students, Lawyers, Judges, Trending. | P0 |
| FR-41 | Right panel shows: Suggested mentors, Trending legal topics, Recommended learning resources. | P1 |
| FR-42 | "Trending" filter ranks by recency-weighted engagement (likes + comments) over the last 7 days. | P1 |

### 3.8 Admin / Moderation

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-43 | Admin users shall delete any post or thread. | P1 |
| FR-44 | Admin users shall view reported content. | P2 |

### 3.9 Notifications (P2)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-45 | Emit notifications: new comments, @mentions, suggested connections, learning reminders. | P2 |
| FR-46 | Delivery: in-app bell with unread count; optional email digest. | P2 |

### 3.10 Personal Analytics (P2)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-47 | Personal dashboard: profile views, post engagement, reputation growth. | P2 |
| FR-48 | Roadmap completion velocity visualised. | P2 |

---

## 4. Non-Functional Requirements

### 4.1 Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-01 | Page load (LCP) | < 1.5s |
| NFR-02 | API p95 (non-AI) | < 500 ms |
| NFR-03 | Chatbot response (Gemini, streamed) | < 5s |
| NFR-04 | Concurrent users | 500 |
| NFR-05 | Python function cold start | < 2s (cron warm-keeper every 5 min) |

### 4.2 Security

| ID | Requirement |
|----|-------------|
| NFR-06 | Endpoints (except public GETs) require authentication. |
| NFR-07 | Passwords (if used) hashed with bcrypt/Argon2. |
| NFR-08 | HTTPS enforced. |
| NFR-09 | SQLAlchemy parameterised queries + Pydantic v2 validation. |
| NFR-10 | Rate limiting (100 req/min/IP) via Upstash or in-memory. |
| NFR-11 | NextAuth-issued JWTs verified by Python API using `PYTHON_API_INTERNAL_SECRET`. |

### 4.3 Availability & Reliability

| ID | Requirement |
|----|-------------|
| NFR-12 | Uptime: 99.9% (Vercel SLA). |
| NFR-13 | Graceful degradation: if Gemini fails, chatbot returns a fallback message. |
| NFR-14 | Automated DB backups (provider-managed). |

### 4.4 Usability

| ID | Requirement |
|----|-------------|
| NFR-15 | Mobile-first responsive design (640/768/1024 px). |
| NFR-16 | Sidebar + topbar on desktop; bottom nav on mobile. |
| NFR-17 | Keyboard navigation supported. |
| NFR-18 | All content (posts, threads, AI responses) must respect Pakistani laws and cultural norms. No content violating PECA 2016 or hate-speech rules. |
| NFR-19 | WCAG 2.1 AA contrast and focus states. |

### 4.5 Scalability

| ID | Requirement |
|----|-------------|
| NFR-20 | Stateless backend; sessions on the frontend (NextAuth), JWT verified per request. |
| NFR-21 | Connection pooling via Neon pooled URL (max 20 concurrent connections per function instance). |

### 4.6 Branding & Visual System

| ID | Requirement |
|----|-------------|
| NFR-22 | Palette: **navy blue (primary)**, **white (surface)**, **gold (accents/CTAs/badges)**. |
| NFR-23 | Typography: **Serif headings** (Playfair Display / Lora) + **Sans-serif body** (Inter). |
| NFR-24 | Card-based layout; persistent sidebar + topbar (desktop), bottom nav (mobile). |

---

## 5. System Architecture

### 5.1 High-Level Architecture

```
[Client Browser]
      │
      ▼
[Vercel Edge / CDN]
      │
      ├──► Next.js Frontend (App Router – RSC + client components)
      │       │  (NextAuth handles OAuth/magic-link, issues JWT)
      │       ▼
      │     fetch /api/* with Bearer JWT
      │
      └──► /api/*.py → Vercel Serverless (Python / FastAPI)
                    │  (verifies JWT via shared secret)
                    │
                    ├── PostgreSQL (Neon) via SQLAlchemy + asyncpg
                    ├── Google Gemini API (external)
                    └── Vercel Blob Storage (images)
```

### 5.2 Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Frontend | Next.js (App Router) | 14.x / 15.x |
| UI Library | React | 18.x |
| Frontend Language | TypeScript | 5.x |
| Styling | Tailwind CSS + shadcn/ui | 3.x |
| Backend | FastAPI on `@vercel/python` | 0.115+ |
| Backend Runtime | CPython | 3.11+ |
| ORM | SQLAlchemy + asyncpg | 2.x |
| Database | PostgreSQL (Neon) | 15+ |
| Auth | NextAuth.js + JWT | 5.x |
| AI Integration | `google-generativeai` (Python SDK) — **no LangChain/LangGraph** | latest |
| File Storage | Vercel Blob | latest |
| Validation | Pydantic v2 (backend), Zod (frontend) | latest / 3.x |
| Search (P1) | Postgres `tsvector` + GIN | native |
| Deployment | Vercel + GitHub auto-deploy | - |

### 5.3 API Design

| Method | Endpoint | Handler | Description | Priority |
|--------|----------|---------|-------------|----------|
| POST | `/api/auth/session` | `api/auth/session.py` | Verify JWT, return user | P0 |
| GET | `/api/profile/[id]` | `api/profile/[id].py` | Public profile | P0 |
| PUT | `/api/profile` | `api/profile/index.py` | Update own profile | P0 |
| GET/POST/DELETE | `/api/posts` | `api/posts/index.py` | Articles | P0 |
| GET | `/api/feed` | `api/feed.py` | Filtered feed | P0 |
| POST | `/api/posts/[id]/save` | `api/posts/[id]/save.py` | Save / unsave | P0 |
| GET/POST/DELETE | `/api/forum/threads` | `api/forum/threads.py` | Threads (8 categories + tags) | P0 |
| GET/POST/DELETE | `/api/forum/replies` | `api/forum/replies.py` | Replies | P0 |
| POST | `/api/chatbot` | `api/chatbot.py` | Gemini call (streamed); accepts `mode` | P0 |
| GET | `/api/journey/[year]` | `api/journey/[year].py` | Roadmap content | P0 |
| POST | `/api/journey/progress` | `api/journey/progress.py` | Mark complete | P0 |
| GET | `/api/search` | `api/search.py` | Global search | P1 |
| GET | `/api/suggestions/mentors` | `api/suggestions/mentors.py` | Right panel | P1 |
| GET | `/api/suggestions/topics` | `api/suggestions/topics.py` | Right panel | P1 |
| GET | `/api/notifications` | `api/notifications.py` | Notifications | P2 |
| GET | `/api/analytics/me` | `api/analytics/me.py` | Personal analytics | P2 |

---

## 6. External Interface Requirements

### 6.1 User Interfaces
- 7 core screens: Landing, Dashboard, Profile, Forum, Chatbot, Year Journey, Create Post.
- Brand: navy + white + gold; serif headings; sans-serif body; card-based.
- Lucide React icons; skeletons + streaming tokens for loading states.

### 6.2 Hardware Interfaces
- None.

### 6.3 Software Interfaces

| Interface | Purpose | Protocol | Data Format |
|-----------|---------|----------|--------------|
| Google Gemini API | AI chat (Pakistan prompt, two modes) | HTTPS | JSON (SSE for streaming) |
| Vercel Blob | Image storage | HTTPS | Binary / JSON |
| PostgreSQL (Neon) | Data persistence | TCP (TLS) | SQL |

### 6.4 Communication
- HTTPS + JSON. Auth via `Authorization: Bearer <JWT>` to the Python API.

---

## 7. Database Requirements

### 7.1 Logical Data Model (SQLAlchemy)

```python
class User(Base):
    id, email (unique), name
    user_type: Enum(STUDENT, LAWYER, JUDGE)
    year: int | None              # 1-5 for students
    specialization: str | None
    bio: str | None
    avatar_url: str | None
    experience: str | None
    achievements: JSON            # list[ {title, year, link?} ]
    reputation: int (default=0)
    country: str (default="Pakistan")   # P2 reserved
    created_at: datetime

class Post(Base):
    id, title, content, author_id (FK), likes (int), created_at
    full_text: tsvector            # GIN-indexed (FR-38)

class Comment(Base):
    id, post_id (FK), author_id (FK), content, created_at

class SavedPost(Base):
    id, user_id (FK), post_id (FK), saved_at
    UNIQUE(user_id, post_id)

class ForumThread(Base):
    id, title, description
    category: Enum(PK_CONSTITUTIONAL, PK_CRIMINAL, CORPORATE_TAX, CIVIL,
                   FAMILY_PERSONAL, CYBER_PECA, CAREER_BAR, LEGAL_AWARENESS)
    author_id (FK), upvotes (int), created_at
    full_text: tsvector            # GIN-indexed

class ForumThreadTag(Base):        # many-to-many
    thread_id (FK), tag: Enum(CONSTITUTION, PPC, CRPC, QANUN_E_SHAHADAT,
                              CPC, SECP, FBR_TAX, PECA, FAMILY_LAWS,
                              SERVICE_TRIBUNALS, FSC, SUPREME_COURT,
                              HIGH_COURTS, OTHER)
    PK(thread_id, tag)

class ForumReply(Base):
    id, thread_id (FK), author_id (FK), content, upvotes, created_at

class Vote(Base):                  # idempotent
    id, voter_id (FK), target_type: Enum(POST, REPLY, THREAD)
    target_id, value: int (-1|+1), created_at
    UNIQUE(voter_id, target_type, target_id)

class ChatSession(Base):
    id, user_id (FK)
    mode: Enum(STUDENT, PROFESSIONAL)
    created_at

class ChatMessage(Base):
    id, session_id (FK), role: Enum(user, assistant, system)
    content, created_at

class YearMilestone(Base):
    id, year (1-4), title, description, content_url, badge, order_index

class UserMilestoneProgress(Base):
    id, user_id (FK), milestone_id (FK), completed_at
    UNIQUE(user_id, milestone_id)

class ReputationEvent(Base):
    id, user_id (FK), delta: int, reason: str
    ref_type: Enum(POST, REPLY, UPVOTE, MILESTONE)
    ref_id, created_at

class UserFilterPreference(Base):  # P1
    id, user_id (FK)
    default_feed_filter: Enum(ALL, STUDENTS, LAWYERS, JUDGES, TRENDING)
    default_forum_category: Enum | None

class Notification(Base):          # P2
    id, user_id (FK), type, payload: JSON, read: bool, created_at

class Report(Base):                # P1/P2
    id, reporter_id (FK), target_type, target_id, reason, created_at
```

### 7.2 Indexes & Constraints
- `posts.full_text`, `forum_threads.full_text` — GIN indexes.
- `votes` UNIQUE — idempotent voting.
- `user_milestone_progress` UNIQUE — milestone bonus awarded once.
- FKs ON DELETE CASCADE for child rows; user deletion follows FR-04 anonymisation flow.

### 7.3 Data Retention
- Accounts: until deletion request, anonymised after 30 days.
- Chat history: 90 days, then purged via cron.
- Reputation events: indefinite (audit trail).
- Posts and threads: indefinite unless deleted by author/admin.

---

## 8. Error Handling & Logging

### 8.1 Error Scenarios

| Scenario | Frontend | Backend |
|----------|----------|---------|
| Invalid login | "Invalid email or password" | 401 |
| Invalid/expired JWT | Redirect to login | 401 |
| Gemini API timeout | "AI is busy, try again" | Fallback: "I cannot answer right now" |
| Gemini safety block | Show neutral apology | 200 with `safety_blocked: true` |
| DB lost | 500 page with retry | 503 |
| Rate-limit exceeded | "Too many requests, wait" | 429 + `Retry-After` |
| Reputation tx conflict | Retry once; else 500 | 500 + `X-Reputation-Retry: 1` |

### 8.2 Logging
- stdout (Vercel captures).
- `INFO`/`WARN`/`ERROR`. Reputation events logged with `user_id`, `delta`, `reason` (no PII).
- No PII in logs (emails, passwords, full chat content).

---

## 9. Security Requirements

| ID | Requirement |
|----|-------------|
| SEC-01 | Python API verifies NextAuth JWT signature via `PYTHON_API_INTERNAL_SECRET`. |
| SEC-02 | CORS restricted to the Vercel frontend domain. |
| SEC-03 | Env vars (DB URL, Gemini key, JWT secret) in Vercel project settings, never committed. |
| SEC-04 | Chatbot input sanitised (max 2000 chars; system prompt isolated; `mode` is a closed enum). |
| SEC-05 | User-uploaded images validated (MIME + size); served via Vercel Blob. |
| SEC-06 | All inputs validated server-side with Pydantic v2. |
| SEC-07 | Reputation mutations only via authoritative endpoints inside DB transactions; clients cannot set `reputation` directly. |
| SEC-08 | Content moderation: report flow + admin take-down; AI responses subject to Gemini safety filters and platform policy aligned with PECA 2016. |

---

## 10. Deployment Requirements

### 10.1 Build & Deploy
1. GitHub → Vercel auto-deploy.
2. Vercel installs Node deps (`npm install`) and Python deps (`pip install -r requirements.txt`).
3. Next.js build + `@vercel/python` bundles each `api/*.py` as an independent serverless function.
4. PRs get preview deployments; `main` ships production.
5. Cron warm-keeper pings cold-prone Python functions every 5 min (NFR-05).

### 10.2 Environment Variables
```env
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GEMINI_API_KEY=...                 # Google AI Studio key
BLOB_READ_WRITE_TOKEN=...
RESEND_API_KEY=                    # optional, magic-link emails
PYTHON_API_INTERNAL_SECRET=        # JWT shared HS256 secret
```

### 10.3 `vercel.json`
```json
{
  "framework": "nextjs",
  "builds": [
    { "src": "package.json", "use": "@vercel/next" },
    { "src": "api/**/*.py", "use": "@vercel/python" }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "/api/$1" },
    { "src": "/(.*)", "dest": "/$1" }
  ],
  "functions": {
    "api/chatbot/**/*.py": { "maxDuration": 30 }
  }
}
```

### 10.4 Future Migration
Split into Vercel (frontend) + Render/Railway (Python backend) by changing `NEXT_PUBLIC_API_BASE_URL` and widening CORS. No code restructuring required.

---

## 11. Acceptance Criteria (MVP)

- [ ] Sign-up / login (magic link or OAuth) works.
- [ ] Profile editable with **experience** and **achievements**.
- [ ] **Reputation score** updates correctly per FR-11 and is visible.
- [ ] Posts can be published and saved; feed shows **Students/Lawyers/Judges/Trending** filters.
- [ ] Forum supports **8 Pakistan-specific categories** and **domain tags**; voting works.
- [ ] Chatbot answers using **Google Gemini** with the **Pakistan-edition system prompt**, supports **Student / Professional** modes, and shows the disclaimer.
- [ ] Mode-specific suggested prompts displayed.
- [ ] **No LangChain / LangGraph** present in `requirements.txt` (verified in CI / review).
- [ ] Roadmap shows progress bars + checklists + badges; the 3-yr/5-yr note is rendered.
- [ ] Dashboard renders sidebar + filtered feed + right panel on desktop.
- [ ] Brand styling applied (navy + white + gold; serif headings; sans-serif body).
- [ ] Responsive on mobile (sidebar → bottom nav).
- [ ] Deployed on Vercel from GitHub (Next.js + Python serverless co-hosted).
- [ ] All env vars set and functional.

---

## 12. Future Enhancements (P2)

- Notifications (in-app + email)
- Personal analytics dashboard
- Pakistani legal document templates (affidavits, vakalatnamas, sale deeds)
- 1-on-1 mentorship booking
- Job & internship board (chambers, SECP, FBR, NGOs)
- Live moot court practice
- Certificates for milestones
- React Native mobile app
- Split deployment (Vercel + Render/Railway)
- RAG over Pakistani statutes/judgments — only then revisit LangChain

---

**Approval**: (to be signed off by hackathon team)
**Next Step**: Phase 1 – Next.js + FastAPI scaffold + Gemini integration.
