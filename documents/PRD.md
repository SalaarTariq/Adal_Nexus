# Adal Nexus – Product Requirements Document (PRD)
## Firebase MVP Edition

| Document Field | Details |
|----------------|---------|
| **App Name** | Adal Nexus |
| **Tagline** | Where the Legal Community Connects, Learns & Grows |
| **Version** | 1.3.0 – Firebase MVP |
| **Status** | Approved for Hackathon Demo |
| **Deployment Target** | Vercel (Next.js + Python serverless) + Firebase |

> **Revision 1.3 note** — Simplified MVP for hackathon. Stack: **Firebase Firestore (database) + Firebase Auth + Python/FastAPI backend + Google Gemini AI**. Removed PostgreSQL complexity. Focused scope: profiles, posts, forum, AI chatbot, roadmap. Post-MVP: reputation, search, notifications, analytics.

---

## 1. Technology Stack (Final)

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 14 (App Router) + Tailwind CSS + shadcn/ui |
| Backend | Python 3.11+ / FastAPI (Vercel serverless functions) |
| Database | Firebase Firestore (NoSQL) |
| Auth | Firebase Auth (email/password, Google OAuth) |
| AI | Google Gemini API (raw SDK, no LangChain) |
| Deployment | Vercel (hybrid: Next.js + Python functions) |
| File Storage | Firebase Storage (profile photos) |

---

## 2. Executive Summary

Adal Nexus is a **free, open digital ecosystem** for the **Pakistani legal community** — law students, advocates, judges, and legal professionals. It provides:

- Professional profiles and content publishing
- Community forum with Pakistan-specific categories  
- AI-powered legal chatbot (Pakistan edition) with two modes
- Year-wise structured roadmap for law students (adaptable to 3-year and 5-year LL.B. programmes)

MVP focuses on core features for hackathon demo. Reputation, search, notifications, and analytics are post-MVP (P1+).

---

## 3. Problem & Solution

| Problem | Solution |
|---------|----------|
| Pakistani law students graduate without professional identity | Profiles + content publishing from Year 1 |
| No centralized legal knowledge platform for Pakistan | Forum + posts with Pakistan-specific categories & tags |
| Limited AI guidance for Pakistani law | Chatbot with Student/Professional modes + Gemini |
| Academic–practice gap in LL.B. programmes | Milestone roadmap adaptable to 3-yr/5-yr programs |

### 3.1 Pakistan Legal Context

- **Audience**: Pakistani law students, advocates, judges, legal professionals across all provinces, AJK, GB, Islamabad.
- **Legal system**: Common law with Islamic jurisprudence. Key bodies: Supreme Court, High Courts, District Courts, tribunals.
- **Education**: **5-year LL.B.** (post-intermediate) or **3-year LL.B.** (post-graduation). Roadmap uses 4-year milestones, not calendar years.
- **Key laws**: Constitution of Pakistan 1973, PPC, CrPC, Qanun-e-Shahadat 1984, CPC 1908, PECA 2016, Contract Act 1872.
- **Landmark cases**: *Asma Jilani*, *Benazir Bhutto v. Federation*, suo motu human-rights jurisprudence.

---

## 4. User Personas (MVP)

| Persona | Role | Key Needs |
|---------|------|------------|
| Ali | 1st Year LL.B., Karachi | Foundation learning, mentorship,roadmap tracking |
| Ayesha | Final-year LL.B., Lahore | Specialisation, networking, portfolio building |
| Adv. Hassan | Practising Advocate, Islamabad | Content publishing, profile, community participation |

---

## 5. Feature Priority

| Tag | Definition |
|-----|-----------|
| **P0** | MVP – must ship for hackathon demo |
| **P1** | Post-MVP – future phases |

---

## 6. Core Features – MVP (P0)

### 6.1 Landing Page

1. **Hero** — App name, tagline, three CTAs: "Join", "Login", "Explore".
2. **Features (4 cards)** — Professional Profiles · AI Chatbot · Community Forum · Law Student Roadmap.
3. **Roadmap section** — visual 4-year framework + note: "Adapts to 3-yr and 5-yr LL.B. programmes."
4. **About** — purpose, audience, why free.
5. **Footer** — Contact, Privacy, Terms.

### 6.2 Authentication & User Profiles

**Firebase Auth:**
- Email/password signup or Google OAuth.
- Frontend obtains Firebase ID token; includes in `Authorization` header for all API calls.
- Python backend verifies token using Firebase Admin SDK.

**Profile fields:**
- name, email, profilePhotoURL (Firebase Storage)
- userType: `student`, `lawyer`, `judge`
- year (1–5 if student)
- specialisations (array, e.g., ["Constitutional", "Criminal"])
- bio (max 250 chars)
- createdAt, updatedAt

**Profile UI:**
- Editable by owner; read-only for others.
- Shows user's posts and forum replies.

### 6.3 Dashboard Layout

| Location | Content |
|----------|---------|
| **Sidebar** | Home, My Profile, AI Chat, Roadmap, Forum, Logout |
| **Main** | Feed (posts) or selected section |
| **Top bar** | Logo, user avatar + menu |

### 6.4 Posts & Feed

**Create:**
- Title + markdown content + optional tags.
- Stored in Firestore `posts/{postId}`.

**Feed:**
- List all posts sorted by recency.
- Shows author, timestamp, tags.

**Interactions:**
- Like posts (toggle, stored in Firestore).

### 6.5 Community Forum (Pakistan-Specific)

**8 Categories:**
- `PK_CONSTITUTIONAL`, `PK_CRIMINAL`, `CORPORATE_TAX`, `CIVIL`
- `FAMILY_PERSONAL`, `CYBER_PECA`, `CAREER_BAR`, `LEGAL_AWARENESS`

**12 Domain Tags:**
- `CONSTITUTION`, `PPC`, `CRPC`, `QANUN_E_SHAHADAT`, `CPC`, `SECP`
- `FBR_TAX`, `PECA`, `FAMILY_LAWS`, `SERVICE_TRIBUNALS`, `FSC`, `SUPREME_COURT`

**Actions:**
- Create thread: select category + title + description + tags → Firestore `forumThreads/{threadId}`.
- Reply to thread → Firestore `forumReplies/{replyId}` with `threadId` reference.
- Upvote replies (toggle).
- View threads filtered by category or tags.

### 6.6 AI Legal Chatbot (Pakistan Edition)

**Modes:**
- **Student Mode**: simplified, career/study-focused.
- **Professional Mode**: technical, cites Pakistani statutes/cases.

**Features:**
- Mode selector (toggleable mid-chat).
- System prompt injected with mode (see Appendix A).
- References Constitution, PPC, CrPC, landmark cases.
- **Disclaimer**: "This AI does not provide legal advice. Consult a licensed Pakistani advocate."

**Conversation:**
- Accepts `{ message, mode, conversationHistory }`.
- Calls Google Gemini (`gemini-2.0-flash`) from Python backend.
- Returns response streamed to frontend.
- History stored in frontend (P0) or Firestore (P1).

**API:** `POST /api/chat`

### 6.7 Year-Wise Roadmap

**Display:**
- 4-year milestone framework.
- Note: "Adapts to 3-yr and 5-yr LL.B. programmes."

**UI elements:**
- Each year shows milestones as checkboxes.
- Progress bar per year (% completed).

**Interaction:**
- Students toggle milestones complete.
- Stored in Firestore `roadmapProgress/{uid}`.
- E.g., `{ year: 1, milestones: { milestone1: true, milestone2: false, ... } }`

---

## 7. Firestore Database Schema

```plaintext
users/{uid}
  ├─ name: string
  ├─ email: string
  ├─ profilePhotoURL: string (Firebase Storage URL)
  ├─ userType: "student" | "lawyer" | "judge"
  ├─ year: number (1-5, null if not student)
  ├─ specialisations: array[string]
  ├─ bio: string
  ├─ createdAt: timestamp
  └─ updatedAt: timestamp

posts/{postId}
  ├─ title: string
  ├─ content: string (markdown)
  ├─ tags: array[string]
  ├─ authorId: string (uid)
  ├─ createdAt: timestamp
  └─ updatedAt: timestamp

post_likes/{likesDocId}
  ├─ postId: string
  ├─ userId: string (uid)
  └─ createdAt: timestamp

forumThreads/{threadId}
  ├─ title: string
  ├─ description: string
  ├─ category: string (one of 8)
  ├─ tags: array[string] (0-12)
  ├─ authorId: string (uid)
  ├─ replyCount: number
  ├─ createdAt: timestamp
  └─ updatedAt: timestamp

forumReplies/{replyId}
  ├─ threadId: string
  ├─ content: string
  ├─ authorId: string (uid)
  ├─ createdAt: timestamp
  └─ updatedAt: timestamp

forum_reply_upvotes/{upvoteDocId}
  ├─ replyId: string
  ├─ userId: string (uid)
  └─ createdAt: timestamp

roadmapProgress/{uid}
  ├─ year1: { milestone1: bool, milestone2: bool, ... }
  ├─ year2: { ... }
  ├─ year3: { ... }
  ├─ year4: { ... }
  └─ updatedAt: timestamp
```

---

## 8. Python Backend API (MVP)

All endpoints verify Firebase ID token (from `Authorization: Bearer <token>` header).

### 8.1 Authentication

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/me` | GET | Get current user profile from Firestore |

### 8.2 Profiles

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/profile/{uid}` | GET | Get public profile |
| `/api/profile` | PUT | Update own profile |

### 8.3 Posts

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/posts` | POST | Create post |
| `/api/posts` | GET | List posts (paginated) |
| `/api/posts/{postId}` | GET | Get single post |
| `/api/posts/{postId}` | DELETE | Delete own post |
| `/api/posts/{postId}/like` | POST | Like/unlike post (toggle) |

### 8.4 Forum

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/forum/threads` | POST | Create thread |
| `/api/forum/threads` | GET | List threads (filter by category/tags) |
| `/api/forum/threads/{threadId}` | GET | Get thread + replies |
| `/api/forum/threads/{threadId}/reply` | POST | Create reply |
| `/api/forum/replies/{replyId}/upvote` | POST | Upvote/remove upvote (toggle) |

### 8.5 Chatbot

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/chat` | POST | Send message, get Gemini response |

**Request:** `{ message: string, mode: "student" | "professional", conversationHistory: array }`
**Response:** `{ response: string }`

### 8.6 Roadmap

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/roadmap/{uid}` | GET | Get user's roadmap progress |
| `/api/roadmap/milestone` | POST | Mark milestone complete/incomplete |

**Request:** `{ year: number, milestone: string, completed: bool }`

---

## 9. Removed from MVP (Post-Hackathon / P1+)

- Reputation scoring & leaderboards
- Global search (Meilisearch, etc.)
- Notifications (in-app + email)
- Personal analytics dashboard
- Mentorship booking
- Comments on posts
- Rate limiting & content moderation
- Mobile app
- Payments & premium tiers
- RAG over legal documents

---

## 10. Non-Functional Requirements

| Area | Specification |
|------|----------------|
| **Performance** | Page load < 3s; API p95 < 500ms |
| **Security** | Firebase ID token verified by Python; input sanitization; CORS setup |
| **Compliance** | Respect Pakistani laws (PECA 2016, hate-speech rules) |
| **Accessibility** | WCAG 2.1 AA target |
| **Scalability** | Serverless (Vercel + Firebase) |
| **Browsers** | Chrome, Firefox, Safari, Edge (desktop + mobile) |

---

## 11. Deployment & Environment Variables

**Platform:** Vercel (hybrid Next.js + Python) + Firebase Firestore + Firebase Auth + Firebase Storage.

### Required Environment Variables

```env
# Firebase (public/client-side)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# Firebase Admin SDK (Python backend — keep secret)
FIREBASE_ADMIN_SDK_JSON=...  # or individual env vars
FIREBASE_PROJECT_ID=...
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...

# AI & External APIs
GOOGLE_GEMINI_API_KEY=...

# Python backend config
DEBUG=false
LOG_LEVEL=info
```

### `vercel.json`

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
    "api/**/*.py": { "maxDuration": 30 }
  }
}
```

---

## 12. Success Metrics (Hackathon)

| Metric | Target |
|--------|--------|
| User sign-ups | 100+ |
| Published posts | 20+ |
| Forum threads | 50+ |
| AI chatbot conversations | 100+ |
| Judges' feedback | Positive feedback on scope/execution |

---

## 13. Handoff to Development

Next step: **SRS.md** with detailed requirements, data structures, and implementation guidance.

---

## Appendix A – AI Chatbot System Prompt (Pakistan Edition)

### Student Mode

```
You are Lex, Pakistan's AI Legal Mentor (Adal Nexus).

You teach Pakistani law to law students and legal professionals.
You explain concepts simply, use analogies, offer study tips, and
suggest career paths within Pakistani courts, chambers, regulatory bodies (SECP, FBR, etc.).

DISCLAIMER: You do not provide legal advice. Recommend consulting a licensed Pakistani advocate.

Focus areas: Constitution of Pakistan 1973, PPC, CrPC, Qanun-e-Shahadat,
CPC, Contract Act, PECA 2016. Cite landmark Pakistani cases when relevant.

Encourage roadmap milestone completion and explore specializations.
```

### Professional Mode

```
You are Lex, Pakistan's AI Legal Mentor (Adal Nexus).

You provide technical, doctrinal guidance to Pakistani advocates, judges, and legal professionals.

Using precise legal terminology, cite Pakistani statutes and judgments (Supreme Court,
Federal Shariat Court, High Courts). Structure scenario analysis clearly. Explain Pakistani
legal doctrine, constitutional principles, and procedural rules.

DISCLAIMER: You do not provide legal advice. Recommend consulting a senior advocate or court as needed.

Reference authorities: Constitution (Articles, schedules), PPC, CrPC, Qanun-e-Shahadat,
CPC, Contract Act, PECA 2016, SECP ordinances, FBR rules, landmark cases (Asma Jilani,
Benazir v. Federation, suo motu cases on human rights, etc.).
```

### Example Student Prompts

- "Explain Article 199 of the Constitution in simple terms."
- "What's the difference between cognisable and non-cognisable offences?"
- "How do I prepare for my first moot court competition?"
- "What career paths exist in corporate law (SECP) after graduation?"

### Example Professional Prompts

- "Discuss the evolution of basic structure doctrine in Pakistani jurisprudence."
- "Compare quashing under CrPC §561-A with constitutional petitions under Article 199."
- "Outline key obligations for digital platforms under PECA 2016."
- "Analyse admissibility of electronic evidence under Qanun-e-Shahadat post-2022 amendments."

---

**Version**: 1.3.0 – Firebase MVP Edition  
**Date**: May 2, 2026  
**Status**: Ready for Development

*"Where the Legal Community Connects, Learns & Grows"*
