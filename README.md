# 💰 FinanceBook — Personal Finance Tracker

A full-stack MERN application for personal finance management using **double-entry accounting** (GAAP compliant), with Firebase authentication, role-based access, and complete financial reporting.

---

## ✨ Features

### 🔐 Authentication & Access Control
- Firebase Email/Password + Google OAuth
- Admin approval workflow (new users wait for admin approval)
- Role-based access: `admin` / `user`
- Password change from Settings (with re-authentication)
- First registered user automatically becomes Admin

### 💳 Transaction Types (Double-Entry)
| Type | Debit | Credit |
|---|---|---|
| **Cash Receive** | Cash (auto) | Income/Source Account |
| **Cash Payment** | Expense Account | Cash (auto) |
| **Fund Transfer** | Selected Account | Selected Account |
| **Multiple Transfer** | Multiple lines | Multiple lines (ΣDr = ΣCr enforced) |

- All transactions use MongoDB sessions for atomicity
- Void with reason (reverses journal entries)
- Transaction detail modal with full journal entry view

### 📊 Financial Reports
- **Trial Balance** — All accounts, total Dr = Cr verified
- **Income Statement** — Revenue vs Expenses, Net Income/Surplus
- **Balance Sheet** — Assets = Liabilities + Equity (Net Income flows automatically)
- **Cash Flow Statement** — Operating / Investing / Financing activities
- All reports printable, filterable by date range

### 🏦 Chart of Accounts
- Full CRUD for accounts
- Auto-assigned Sub-Account and Financial Statement based on type
- Mark accounts as "Cash" for automatic use in simple transactions
- Account Ledger with running balance, date filtering
- Sign convention: Assets negative, Liabilities/Equity positive (sum = 0)

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router v6, Tailwind CSS |
| Charts | Recharts |
| Backend | Node.js, Express.js |
| Database | MongoDB + Mongoose |
| Auth | Firebase Authentication |
| State | Context API + React Hooks |
| HTTP | Axios with interceptors |
| Notifications | react-hot-toast |
| Security | Helmet, CORS, Rate Limiting, MongoDB sessions |

---

## 📁 Project Structure

```
finance-app/
├── client/                     # React Frontend
│   ├── public/index.html
│   └── src/
│       ├── firebase/config.js  # Firebase setup
│       ├── context/AuthContext.js
│       ├── utils/
│       │   ├── api.js          # Axios + token injection
│       │   └── format.js       # Currency, date formatters
│       ├── components/
│       │   ├── layout/Layout.js    # Sidebar + navigation
│       │   └── ui/                 # Modal, Confirm, StatCard, etc.
│       └── pages/
│           ├── LoginPage.js
│           ├── RegisterPage.js
│           ├── PendingApprovalPage.js
│           ├── DashboardPage.js
│           ├── TransactionsPage.js
│           ├── NewTransactionPage.js
│           ├── AccountsPage.js
│           ├── LedgerPage.js
│           ├── SettingsPage.js
│           ├── AdminPage.js
│           └── reports/
│               ├── TrialBalancePage.js
│               ├── IncomeStatementPage.js
│               ├── BalanceSheetPage.js
│               └── CashFlowPage.js
│
└── server/                     # Express Backend
    ├── index.js                # Entry point
    ├── middleware/
    │   ├── auth.js             # Firebase token verification
    │   └── errorHandler.js     # Global error handler
    ├── models/
    │   ├── User.js
    │   ├── Account.js
    │   └── Transaction.js      # Double-entry with DR=CR validation
    └── routes/
        ├── auth.js
        ├── accounts.js         # Chart of Accounts + Ledger
        ├── transactions.js     # All 4 types + void
        ├── reports.js          # Financial statements
        └── admin.js            # User management
```

---

## 🚀 Setup & Installation

### 1. Firebase Setup
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project
3. Enable **Authentication** → Sign-in methods → Enable **Email/Password** and **Google**
4. Go to **Project Settings** → **Service Accounts** → **Generate new private key**
5. Copy values to `server/.env`
6. Go to **Project Settings** → **Your Apps** → Add a Web App
7. Copy Firebase config to `client/.env`

### 2. MongoDB Setup
```bash
# Local MongoDB
mongod --dbpath /data/db

# OR use MongoDB Atlas (cloud):
# Create cluster at https://cloud.mongodb.com
# Get connection string
```

### 3. Environment Variables

**`server/.env`**
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/finance_tracker
CLIENT_URL=http://localhost:3000

FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
```

**`client/.env`**
```env
REACT_APP_FIREBASE_API_KEY=your-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
REACT_APP_FIREBASE_APP_ID=your-app-id
REACT_APP_API_URL=http://localhost:5000/api
```

### 4. Install & Run

```bash
# Install all dependencies
npm run install-all

# Run both server and client (development)
npm run dev

# Run server only
npm run server

# Run client only
npm run client
```

App runs on:
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:5000

---

## 🏗 Initial Data Setup

After first login (you'll be auto-admin), go to **Chart of Accounts** and:

1. Create your cash account(s) — mark one as **"Cash Account"**
2. Import your accounts from the Excel file (or create manually)
3. Set opening balances
4. Start recording transactions!

### Opening Balance Convention
Your Excel uses: **Assets = negative, Liabilities/Equity = positive** (sum = 0)

The system follows this same convention. The Trial Balance should always sum to zero.

---

## 🔒 Security Features
- Firebase ID token verified on every API call
- MongoDB transactions (sessions) for atomic double-entry
- Rate limiting (200 req / 15min)
- Helmet.js security headers
- Input validation on all endpoints
- Global error handler with safe error messages
- Admin approval gate before any data access

---

## 📱 Pages & Navigation

| Page | Path | Access |
|---|---|---|
| Login | `/login` | Public |
| Register | `/register` | Firebase authenticated |
| Pending | `/pending` | Registered, not yet approved |
| Dashboard | `/dashboard` | Approved users |
| New Transaction | `/transactions/new` | Approved users |
| Transactions | `/transactions` | Approved users |
| Chart of Accounts | `/accounts` | Approved users |
| Account Ledger | `/accounts/:id/ledger` | Approved users |
| Trial Balance | `/reports/trial-balance` | Approved users |
| Income Statement | `/reports/income-statement` | Approved users |
| Balance Sheet | `/reports/balance-sheet` | Approved users |
| Cash Flow | `/reports/cash-flow` | Approved users |
| Settings | `/settings` | Approved users |
| Admin | `/admin` | Admin only |

---

## 🌐 Deployment

### Frontend (Vercel/Netlify)
```bash
cd client
npm run build
# Deploy the /build folder
```

### Backend (Railway/Render)
```bash
cd server
# Set environment variables in dashboard
# Start command: node index.js
```
