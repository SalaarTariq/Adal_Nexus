# Adal Nexus – Firebase MVP Deployment Guide v1.3.0

> Complete end-to-end deployment guide for Pakistan's Legal Community Platform using Firebase, NextJS, and FastAPI.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Firebase Setup](#firebase-setup)
3. [Environment Variables](#environment-variables)
4. [Local Development](#local-development)
5. [Firestore Security Rules](#firestore-security-rules)
6. [Deployment to Vercel](#deployment-to-vercel)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **Node.js 18+** and npm/pnpm
- **Python 3.11+** and pip
- **Firebase Project** (free tier OK)
- **Vercel Account** (for deployment)
- **Git** for version control

---

## Firebase Setup

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create Project" → name it "Adal Nexus"
3. Enable Google Analytics (optional)
4. Wait for project initialization

### 2. Enable Services

#### Firestore (Database)
1. Go to **Firestore Database** → Create database
2. Choose **Production Mode** (security rules are in `firestore.rules`)
3. Select region: **asia-southeast1** (Singapore, closest to Pakistan)
4. Click **Enable**

#### Firebase Authentication
1. Go to **Authentication** → **Sign-in method**
2. Enable:
   - **Email/Password**
   - **Google** (optional, for OAuth)
3. Add authorized domains:
   - `localhost:3000` (development)
   - `adal-nexus.vercel.app` (production)
   - Your Vercel preview domains

#### Firebase Storage
1. Go to **Storage** → **Get Started**
2. Choose production mode
3. Select region: **asia-southeast1**
4. Click **Done**

### 3. Get Firebase Credentials

#### Web SDK Credentials (for frontend)
1. Go to **Project Settings** (gear icon)
2. Select **Your apps** tab
3. Under "Web apps", click your app or create new
4. Copy the config object – you'll need these 6 values:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`

#### Service Account Credentials (for backend)
1. Go to **Project Settings** → **Service Accounts**
2. Click **Generate New Private Key**
3. Save the JSON file safely (contains private key)
4. Extract these values:
   - `project_id`
   - `private_key` (keep the newlines as-is)
   - `client_email`
   - `private_key_id`

### 4. Enable Google Gemini API (for AI Chat)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Ensure your Firebase project is selected
3. Follow [this guide for Gemini API](https://ai.google.dev/docs/gemini_api_overview)
   - Enable **Google AI Studio API** (if using direct credentials)
   - OR enable **Vertex AI** (if using service account)
4. Get **API Key** from Google AI Studio (not the service account)

---

## Environment Variables

Create `.env.local` in the root directory (copy from `.env.local.example`):

```bash
# Firebase Web SDK (required, NEXT_PUBLIC_* are exposed to browser)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin SDK (backend only, NEVER expose these)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY_ID=your_private_key_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your_service_account_email

# Google Gemini API (for AI chatbot)
GOOGLE_GENERATIVEAI_API_KEY=your_gemini_api_key
```

**⚠️ Security Alert:**
- `.env.local` is in `.gitignore` – never commit it
- `NEXT_PUBLIC_*` variables are public (safe to expose)
- `FIREBASE_PRIVATE_KEY` and `GOOGLE_GENERATIVEAI_API_KEY` are secrets – keep them private

For multiline `FIREBASE_PRIVATE_KEY`, paste the entire key with `\n` for newlines:
```
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
```

---

## Local Development

### 1. Install Dependencies

```bash
# Frontend (Next.js)
npm install

# Backend (Python)
cd api
pip install -r requirements.txt
cd ..
```

### 2. Download Firebase Credentials (Optional)

For local testing without environment variables:

```bash
# Place service account JSON in project root
mv ~/Downloads/adal-nexus-*.json ./firebase-key.json
```

### 3. Start Development Servers

**Terminal 1 – Next.js Frontend (port 3000):**
```bash
npm run dev
```

**Terminal 2 – FastAPI Backend (port 8000):**
```bash
cd api
python -m uvicorn main:app --reload --port 8000
```

### 4. Access the App

- **Frontend:** http://localhost:3000
- **API Docs:** http://localhost:8000/docs (Swagger UI)
- **Backend Health:** http://localhost:8000/api/health

### 5. Firebase Emulator (Optional)

For local testing without networking to Firebase:

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Start emulator
firebase emulators:start

# Set emulator env vars
export FIREBASE_EMULATOR_HOST=localhost:9099
```

---

## Firestore Security Rules

The `firestore.rules` file controls who can read/write each collection:

- **users**: Read public, write only own profile
- **posts**: Read all, create if auth, edit/delete if author
- **post_likes**: Read all, like/unlike if auth
- **forumThreads**: Read all, create if auth, edit/delete if author
- **forumReplies**: Read all, create if auth, edit/delete if author
- **forum_reply_upvotes**: Read all, upvote if auth
- **roadmapProgress**: Read/write only own milestones

### Deploy Rules to Firebase

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login (one time)
firebase login

# Deploy rules
firebase deploy --only firestore:rules
```

Alternatively, in Firebase Console:
1. Go to **Firestore** → **Rules**
2. Copy content from `firestore.rules`
3. Paste and click **Publish**

---

## Deployment to Vercel

### 1. Push Code to GitHub

```bash
git add .
git commit -m "Firebase MVP v1.3.0"
git push origin main
```

### 2. Connect Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Add New...** → **Project**
3. Select your GitHub repo
4. Configure:
   - **Framework:** Next.js
   - **Python Runtime:** Enable (for serverless functions)
   - **Root Directory:** `.` (or `/` if monorepo)

### 3. Set Environment Variables

In Vercel dashboard: **Settings** → **Environment Variables**

Add all variables from `.env.local`:

```
NEXT_PUBLIC_FIREBASE_API_KEY = ...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = ...
NEXT_PUBLIC_FIREBASE_PROJECT_ID = ...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = ...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = ...
NEXT_PUBLIC_FIREBASE_APP_ID = ...

FIREBASE_PROJECT_ID = ...
FIREBASE_PRIVATE_KEY_ID = ...
FIREBASE_PRIVATE_KEY = ...
FIREBASE_CLIENT_EMAIL = ...

GOOGLE_GENERATIVEAI_API_KEY = ...
```

### 4. Deploy

```bash
# Manual deploy
vercel deploy --prod

# Or just push to main
git push origin main
```

Your app will be live at `https://adal-nexus.vercel.app`

### 5. Update Firebase Auth Domains

1. Go to Firebase Console → **Authentication** → **Settings**
2. Add `adal-nexus.vercel.app` to authorized domains
3. Add Vercel preview domains: `*.vercel.app`

---

## Testing

### Signup & Login Flow

1. Go to http://localhost:3000
2. Click **"Join as Student"** (or Lawyer/Judge)
3. Fill signup form → your account is created in `users` collection
4. Dashboard loads with Firebase Auth token in localStorage
5. Create a post → stored in `posts` collection
6. Join forum → create thread → post reply

### API Endpoints (with curl)

```bash
# Get Firebase ID token (use your own after signup)
TOKEN="your_id_token"

# Health check
curl http://localhost:8000/api/health

# Get current user
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/auth/me

# List posts
curl http://localhost:8000/api/posts

# Create post
curl -X POST http://localhost:8000/api/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test", "content": "Hello", "tags": ["law"]}'

# Chat with Lex
curl -X POST http://localhost:8000/api/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the Pakistan Penal Code?"}'
```

---

## Troubleshooting

### "Firebase initialization failed"
- Check `.env.local` has all 6 Firebase Web SDK variables
- Verify `NEXT_PUBLIC_` prefix for client vars
- Restart dev server after changing env vars

### "Authorization header missing"
- Frontend not sending Bearer token
- Check browser DevTools → Network → Authorization header
- Verify `user?.getIdToken()` is returning a token

### "User not found in Firestore"
- First signup might not have created profile
- Check Firestore console → collections → users
- Manually create document if missing

### "Chat not working"
- Verify `GOOGLE_GENERATIVEAI_API_KEY` is set
- Check API key is from Google AI Studio (not service account)
- Verify Gemini API is enabled in Google Cloud project

### "Firestore rules rejected write"
- Check rules in `firestore.rules` match collection name
- Verify `request.auth != null` for protected collections
- In Firebase Console → Firestore → Rules, test rule matches

### "Vercel build fails"
- Check Python version in `api/requirements.txt`
- Run `npm run build` locally to test
- Check logs: Vercel Dashboard → Deployments → Logs

### "CORS errors in browser"
- FastAPI CORS middleware might be misconfigured
- Check `api/main.py` for allowed origins
- Add `http://localhost:3000` to development
- Add Vercel domain to production

---

## Environment Variable Quick Reference

| Variable | Required | Scope | Source |
|----------|----------|-------|--------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | ✅ | Frontend | Firebase Console > Project Settings > Web |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | ✅ | Frontend | Firebase Console > Project Settings > Web |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | ✅ | Frontend | Firebase Console > Project Settings > Web |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | ✅ | Frontend | Firebase Console > Project Settings > Web |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | ✅ | Frontend | Firebase Console > Project Settings > Web |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | ✅ | Frontend | Firebase Console > Project Settings > Web |
| `FIREBASE_PROJECT_ID` | ✅ | Backend | Service Account JSON |
| `FIREBASE_PRIVATE_KEY_ID` | ✅ | Backend | Service Account JSON |
| `FIREBASE_PRIVATE_KEY` | ✅ | Backend | Service Account JSON |
| `FIREBASE_CLIENT_EMAIL` | ✅ | Backend | Service Account JSON |
| `GOOGLE_GENERATIVEAI_API_KEY` | ✅ | Backend | Google AI Studio |

---

## Quick Start Summary

```bash
# 1. Setup
npm install
cd api && pip install -r requirements.txt && cd ..

# 2. Environment
cp .env.local.example .env.local
# Edit .env.local with your Firebase & Gemini credentials

# 3. Development
npm run dev &
cd api && python -m uvicorn main:app --reload &

# 4. Test
open http://localhost:3000

# 5. Deploy
git add . && git commit -m "v1.3.0" && git push
# Vercel auto-deploys from GitHub
```

---

## Support & Resources

- **Firebase Docs:** https://firebase.google.com/docs
- **Next.js Docs:** https://nextjs.org/docs
- **FastAPI Docs:** https://fastapi.tiangolo.com
- **Gemini API Docs:** https://ai.google.dev/docs
- **Firestore Rules:** https://firebase.google.com/docs/firestore/security/get-started

---

**Version:** 1.3.0  
**Last Updated:** 2024  
**Stack:** Firebase + Next.js 14 + FastAPI + Google Gemini
