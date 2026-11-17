# Vault X — Full-Stack Node.js & React Enclave

Vault X is an isolated credential locker and document storage web application built with a full-stack Node.js (Express + Vite) backend, React 19 frontend, and Google Cloud Firestore.

---

## 🚀 How to Run Locally with Node.js

Running the app locally on your machine eliminates cross-origin iframe popup restrictions and runs on `http://localhost:3000` (which is authorized in Firebase by default).

### Prerequisites
- **Node.js**: Install **v20.19.0 or newer in the v20 line, or v22.12.0+** from [nodejs.org](https://nodejs.Thinkingorg/). Vite 8 does not support Node.js 18 or earlier v20/v22 releases.
- **npm** (comes automatically bundled with Node.js)

---

### Step 1: Install Dependencies
Open your terminal inside the project root directory and run:
```bash
npm install
```

---

### Step 2: Configure Environment Variables
Copy `.env.example` to create your local `.env` file:
```bash
cp .env.example .env
```
Inside `.env`, verify or set:
```env
PORT=3000
SUPPORT_EMAIL="oluwolefaith92@gmail.com"
GROQ_API_KEY="YOUR_GROQ_API_KEY" # Optional; preferred AI chatbot provider
GROQ_MODEL="openai/gpt-oss-20b"
GEMINI_API_KEY="YOUR_GEMINI_API_KEY_HERE" # Gemini fallback
```

For Super Admin verification, generate `SUPER_ADMIN_PASSWORD_HASH` with `node scripts/generate-super-admin-password-hash.mjs` and `SUPER_ADMIN_OWNER_WORD_HASH` with `node scripts/generate-super-admin-owner-word-hash.mjs` in interactive terminals. Both inputs are hidden; copy only each generated `scrypt$...` hash into the local `.env` and backend deployment's secret settings. Never configure either plaintext value or expose a hash through a `VITE_` variable. Firebase Admin credentials and Firestore access are required on the backend for persistent lockouts, short-lived one-use challenges, and sessions that remain active until manually ended or revoked.

---

### Step 3: Start the Local Node.js Development Server
Start the local server with one command:
```bash
npm run dev
```

The application will start immediately:
```
[CyberVault Server] Running at http://0.0.0.0:3000
[CyberVault Server] Support Email: oluwolefaith92@gmail.com
```

Open your browser and navigate to:
👉 **`http://localhost:3000`**

---

### Deploy the frontend to GitHub Pages

The GitHub Actions workflow builds the frontend with the `/Vault-X/` base path and deploys it when changes are pushed to `main`. In the repository settings, open **Pages** and set the build and deployment source to **GitHub Actions**. After the workflow succeeds, open the site URL shown in the workflow's deployment summary.

GitHub Pages hosts static files only; Express server endpoints require a separate backend deployment.

### Deploy the frontend to Vercel

Vercel can connect directly to this GitHub repository and automatically redeploy whenever `main` is updated. The included `vercel.json` builds the Vite frontend into `dist/`, forwards `/api/...` requests to the existing Render backend, and routes client-side pages to the app.

1. Sign in at [Vercel](https://vercel.com/) and choose **Add New** → **Project**.
2. Import `Glinnux/Vault-X` from GitHub and deploy the `main` branch. Keep the project root at the repository root; Vercel reads the build, output, and routing settings from `vercel.json`.
3. Leave `VITE_API_BASE_URL` unset so the app uses Vercel's `/api` rewrite. If file uploads use Supabase, add the existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as Vercel environment variables. These are frontend values; never expose a Supabase secret key with a `VITE_` prefix.
4. After the first deployment, add the Vercel hostname (for example, `vault-x.vercel.app`, without `https://` or a path) in Firebase Console → **Authentication** → **Settings** → **Authorized domains**. This is required for Google and email authentication from the new address.
5. In the Render backend's environment settings, set `APP_URL` to the Vercel site URL so recovery and email links point to the deployed site. If you use a custom Vercel domain, use that exact URL. Add the Vercel origin to `APP_ORIGINS` as well if the frontend will call the Render API directly instead of using the `/api` rewrite.
6. Redeploy the Render backend after changing its environment. Then open the Vercel URL and test sign-in, saving an item, and any file upload or email flows you use.

Vercel hosts only the frontend. Keep the Express API, email credentials, Firebase Admin service account, and Supabase secret key on the backend; do not put server secrets in Vercel frontend variables.

### Vault and administrator routes

- `/vault` is the signed-in user's private vault. The account menu links to profile/settings, security information, and (for authorized administrators) `/admin`.
- `/admin` verifies administrator access on the server. Its overview returns aggregate vault counts and permission-limited user metadata; it never returns credential or document contents.
- The overview requires the Firebase Admin SDK on the backend. Activity and security sections explicitly report when persistent event logs are not configured.
- `/superadmin` is guarded by the backend-issued Super Admin session; opening the route or calling a protected API directly does not bypass the password and owner-word checks. The session remains active until manually revoked.
- Firestore Rules also require a server-managed active authorization record for Super Admin privileges. The record is created only after both verification factors succeed and removed when the last active session is revoked.
- Authentication audit entries are stored server-side in `super_admin_audit_logs` with the event, actor UID, timestamp, and limited reason/count metadata. Passwords and owner words are never written to these entries; Firestore clients have no read or write access to this collection.
- Set `FIREBASE_DATABASE_ID` to the same database ID in the Express backend and Firebase Functions environment. For local Functions emulation, copy `functions/.env.example` to `functions/.env`. Build and deploy Functions with `npm --prefix functions run build` followed by `firebase deploy --only functions`. This ensures Functions validate sessions in the same Firestore database as the backend.
- Redeploy the Express backend and Firebase Functions after configuring the hashes and database ID; the static frontend alone cannot activate server-side verification.

---

### Step 4: Production Build & Run (Optional)
To test a production-optimized build locally:
```bash
# 1. Build client bundle and server
npm run build
npm run build:server

# 2. Run with standard Node.js
npm run serve:node
```

---

## 🔑 Why Can't I Sign In? (Diagnosis & Solutions)

If you are experiencing issues signing in, here are the exact causes and step-by-step solutions:

### 1. Browser Popup Blocked (Most Common for Google Sign-In)
- **Cause**: Firebase Google OAuth uses a secure popup window. When running inside web preview iframes (like AI Studio or Cloud Run), web browsers (Chrome, Safari, Firefox, Edge) automatically block popup windows by default.
- **Solution**:
  - Look at the right side of your browser URL/address bar.
  - Click the **"Pop-up blocked"** icon.
  - Select **"Always allow pop-ups and redirects from this site"** and click **Done**.
  - Click **Sign In** again.
  - **Best Solution**: Run locally with Node.js (`npm run dev`) at `http://localhost:3000` where popups open in your top-level browser window without iframe restrictions!

---

### 2. "Domain Not Authorized" (`auth/unauthorized-domain`)
- **Cause**: Firebase Authentication requires all web domains that initiate sign-in to be registered in your Firebase project's Authorized Domains list.
  - `localhost` is **always authorized by default** in Firebase.
  - However, external preview URLs (such as `ais-dev-...run.app`) must be added to Firebase Console if signing in from the preview.
- **Solution**:
  1. Go to the [Firebase Console](https://console.firebase.google.com/).
  2. Select your project: **`gen-lang-client-0532918067`** (or your custom Firebase project).
  3. Navigate to **Authentication** > **Settings** > **Authorized domains**.
  4. Click **Add domain** and enter your current preview domain (e.g. `ais-dev-mpns2gqpwchymy4us6tks6-692956518207.europe-west1.run.app`).
  5. Click **Save**.

---

### 3. Email/Password Sign-In Shows "Provider Disabled" (`auth/operation-not-allowed`)
- **Cause**: When Firebase is first provisioned, Google Cloud enables **Google Sign-In** by default. Email/Password can be toggled on in the Firebase Console:
- **Solution**:
  1. Open [Firebase Console > Authentication > Sign-in method](https://console.firebase.google.com/).
  2. Click **Email/Password**.
  3. Toggle **Enable** to ON and click **Save**.

---

### 4. First-Time Email Sign-In: "Invalid Email or Password"
- **Cause**: By default, the sign-in modal opens on the **"Sign In"** tab. If you have not registered your email and password yet, Firebase cannot find the user account.
- **Solution**:
  - In the sign-in modal, click the **"Create Account (New User)"** tab at the top.
  - Enter your Name, Email, and Password (at least 6 characters).
  - Click **"Register & Create Vault Account"**.
  - Once created, you can sign in anytime using those credentials.

---

## 📁 Project Architecture & Scripts

| Command | Action |
| :--- | :--- |
| `npm run dev` | Runs the full-stack Node.js server (`server.ts`) via `tsx` with Vite middleware mounted at `http://localhost:3000` |
| `npm run build` | Builds the React frontend application into `dist/` |
| `npm run build:server`| Bundles the Express server into `dist-server/server.js` using `esbuild` |
| `npm run serve:node` | Runs the built server directly using pure `node` |
| `npm run lint` | Runs TypeScript type-checks (`tsc --noEmit`) |

---

## 👑 Administrator Accounts & Privileges

- **Primary Super Admin**: `oluwolefaith92@gmail.com`
- Super Admin operations require the password and owner-word verification. The resulting session has no time-based expiry and remains active until manually ended or revoked.
- The Super Admin retains elevated access to the Admin Console, live subscription countdowns, plan approvals, bank transfer verification queues, granular admin permissions editor, and exclusive authority to unban accounts.
