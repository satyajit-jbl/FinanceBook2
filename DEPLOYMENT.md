# 🚀 Deployment Guide — FinanceBook

## Architecture
```
GitHub (source code)
   ├── server/  → Vercel (Node.js API)       https://your-api.vercel.app
   └── client/  → Netlify (React SPA)        https://your-app.netlify.app

MongoDB Atlas (cloud database)              mongodb+srv://...
Firebase (authentication)                   Google / Email auth
```

Auto-deploy: Every `git push` to `main` branch triggers rebuild on both Vercel and Netlify.

---

## STEP 1 — MongoDB Atlas (Free Cloud Database)

1. Go to https://cloud.mongodb.com → Sign up free
2. Create a **free M0 cluster** (select region closest to you)
3. **Database Access** → Add Database User
   - Username: `financeuser`
   - Password: generate a strong one (save it!)
   - Role: `Atlas Admin`
4. **Network Access** → Add IP Address → `0.0.0.0/0` (allow from anywhere — needed for Vercel)
5. **Connect** → "Connect your application" → Copy the connection string:
   ```
   mongodb+srv://financeuser:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   Replace `<password>` with your DB password and add database name:
   ```
   mongodb+srv://financeuser:yourpassword@cluster0.xxxxx.mongodb.net/finance_tracker?retryWrites=true&w=majority
   ```
   **Save this URI** — you'll need it for Vercel.

---

## STEP 2 — Firebase Setup (if not already done)

1. Go to https://console.firebase.google.com
2. Create project → Enable **Authentication** → Sign-in methods:
   - ✅ Email/Password
   - ✅ Google
3. **Project Settings** → **Service Accounts** → **Generate new private key**
   - Download the JSON file (contains `project_id`, `private_key`, `client_email`)
4. **Project Settings** → **Your Apps** → Add Web App → Copy config object

---

## STEP 3 — Push to GitHub

```bash
# In your project root (finance-app/)
git init
git add .
git commit -m "Initial commit — FinanceBook production-ready"

# Create repo on GitHub: https://github.com/new
# Then connect:
git remote add origin https://github.com/YOUR_USERNAME/finance-app.git
git branch -M main
git push -u origin main
```

> ⚠️  `.gitignore` already excludes all `.env` files.
> NEVER commit `.env` files with real credentials.

---

## STEP 4 — Deploy Server to Vercel

### 4a. Install Vercel CLI (optional but useful)
```bash
npm install -g vercel
```

### 4b. Deploy via Vercel Dashboard (recommended)
1. Go to https://vercel.com → Sign up with GitHub
2. **New Project** → Import your `finance-app` GitHub repo
3. **Configure Project:**
   - **Framework Preset**: Other
   - **Root Directory**: `server`  ← IMPORTANT
   - **Build Command**: (leave blank)
   - **Output Directory**: (leave blank)
   - **Install Command**: `npm install`
4. **Environment Variables** — Add ALL of these:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | `mongodb+srv://...` (from Step 1) |
| `CLIENT_URL` | `https://your-app.netlify.app` (fill after Step 5) |
| `FIREBASE_PROJECT_ID` | from Firebase service account JSON |
| `FIREBASE_CLIENT_EMAIL` | from Firebase service account JSON |
| `FIREBASE_PRIVATE_KEY` | from Firebase service account JSON — paste the FULL key including `-----BEGIN...-----END-----` |
| `JWT_SECRET` | Run: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_EXPIRES` | `7d` |

> ⚠️ For `FIREBASE_PRIVATE_KEY`: In Vercel dashboard, paste the key exactly as it appears in the JSON file (with `\n` characters). Vercel handles the newlines correctly.

5. Click **Deploy**
6. After deploy, copy your server URL: `https://finance-app-server-xxxx.vercel.app`

---

## STEP 5 — Deploy Client to Netlify

### 5a. Deploy via Netlify Dashboard (recommended)
1. Go to https://netlify.com → Sign up with GitHub
2. **Add new site** → **Import an existing project** → GitHub
3. Select your `finance-app` repo
4. **Configure build settings:**
   - **Base directory**: `client`
   - **Build command**: `npm run build`
   - **Publish directory**: `client/build`
5. **Environment Variables** (Site settings → Environment variables → Add):

| Variable | Value |
|---|---|
| `REACT_APP_API_URL` | `https://your-server.vercel.app/api` (from Step 4) |
| `REACT_APP_FIREBASE_API_KEY` | from Firebase web app config |
| `REACT_APP_FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` |
| `REACT_APP_FIREBASE_PROJECT_ID` | `your-project-id` |
| `REACT_APP_FIREBASE_STORAGE_BUCKET` | `your-project.appspot.com` |
| `REACT_APP_FIREBASE_MESSAGING_SENDER_ID` | from Firebase config |
| `REACT_APP_FIREBASE_APP_ID` | from Firebase config |
| `CI` | `false` |

6. Click **Deploy site**
7. Note your Netlify URL: `https://finance-app-xxxx.netlify.app`

---

## STEP 6 — Update CLIENT_URL in Vercel

After you have the Netlify URL:
1. Go to Vercel → Your project → **Settings** → **Environment Variables**
2. Update `CLIENT_URL` to your Netlify URL:
   ```
   CLIENT_URL=https://finance-app-xxxx.netlify.app
   ```
3. **Redeploy** the Vercel project (Deployments → Redeploy)

---

## STEP 7 — Firebase Auth Domain (for Google Login)

1. Firebase Console → **Authentication** → **Settings** → **Authorized domains**
2. Add your domains:
   - `your-app.netlify.app`
   - `localhost` (already there)
3. If using custom domain later, add that too.

---

## STEP 8 — Verify Everything Works

```bash
# Test server health
curl https://your-server.vercel.app/api/health

# Expected response:
# {"status":"ok","env":"production","ts":"2026-..."}
```

Then open your Netlify URL and:
- ✅ Register a new account
- ✅ Google login
- ✅ Create a transaction
- ✅ Check reports load

---

## Auto-Deploy Workflow (ongoing)

```
Your local machine → git push → GitHub
                                   ├── Vercel detects change → rebuilds server automatically
                                   └── Netlify detects change → rebuilds client automatically
```

### Daily development workflow:
```bash
# Make your changes locally
npm run dev   # test locally first

# When ready to deploy:
git add .
git commit -m "feat: your change description"
git push origin main
# → Both Vercel and Netlify rebuild automatically (2-3 minutes)
```

### Branch strategy (recommended):
```bash
# Development branch for testing
git checkout -b develop
# ... make changes, test ...
git push origin develop
# → Only triggers deploy if you set up branch deploys in Vercel/Netlify

# Merge to main to go live
git checkout main
git merge develop
git push origin main
# → Live deployment triggered
```

---

## Environment Management

### Development (local):
```
server/.env          ← your local secrets (git-ignored)
client/.env.local    ← your local Firebase config (git-ignored)
```

### Production (cloud):
```
All secrets → Vercel Environment Variables (server)
All secrets → Netlify Environment Variables (client)
Never in files committed to git
```

### Making a change that needs new env vars:
1. Add to `.env` locally and test
2. Add to Vercel/Netlify dashboard
3. Redeploy (or push a commit to trigger auto-deploy)

---

## Troubleshooting

### CORS Error in browser console
- Check `CLIENT_URL` in Vercel env vars exactly matches your Netlify URL (no trailing slash)
- Redeploy Vercel after changing `CLIENT_URL`

### Login fails in production
- Check Firebase Authorized Domains includes your Netlify URL
- Verify `REACT_APP_FIREBASE_*` vars are set in Netlify

### MongoDB connection fails
- Verify Network Access in MongoDB Atlas allows `0.0.0.0/0`
- Check `MONGODB_URI` is correct in Vercel env vars (no spaces)

### Build fails on Netlify
- Check `CI=false` is set in Netlify env vars
- Check Node version is 18 (`NODE_VERSION=18`)

### Cookies not working (local JWT auth fails)
- In production, server sends `SameSite=None; Secure` cookies
- This requires HTTPS on BOTH client and server (Vercel and Netlify both use HTTPS ✅)

### Vercel function timeout
- Free Vercel plan: 10s timeout. Upgrade to Pro (paid) for 60s if needed.

---

## Custom Domain (optional)

### Netlify custom domain:
1. Netlify → Site settings → Domain management → Add custom domain
2. Update DNS at your registrar with Netlify's nameservers

### Vercel custom domain:
1. Vercel → Project → Settings → Domains → Add domain
2. Update `CLIENT_URL` in Vercel env to use new domain

---

## Cost Summary (for study/personal use)

| Service | Plan | Cost |
|---|---|---|
| MongoDB Atlas | M0 Free Tier (512MB) | **Free forever** |
| Vercel | Hobby Plan | **Free** (100GB bandwidth/mo) |
| Netlify | Free Plan | **Free** (100GB bandwidth/mo) |
| Firebase Auth | Spark Plan | **Free** (10K auth/month) |
| GitHub | Free Plan | **Free** |
| **Total** | | **৳0 / month** |

