# Secure Data Vault (SDV) Enterprise

![Secure Data Vault](https://img.shields.io/badge/Security-Enterprise-blueviolet?style=for-the-badge)
![Encryption](https://img.shields.io/badge/Encryption-AES%20256%20GCM%20%2B%20RSA-blue?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-Backend-green?style=for-the-badge)
![React](https://img.shields.io/badge/React-Frontend-61DAFB?style=for-the-badge&logo=react)
![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791?style=for-the-badge&logo=postgresql)

The **Secure Data Vault Enterprise** is a highly secure, object-oriented system designed to securely encrypt, store, and manage highly sensitive files. Re-architected with **Prisma, PostgreSQL, and Supabase**, it features strict Role-Based Access Control (RBAC), end-to-end envelope encryption using asymmetric user keys, granular auditing, and distinct administrative interfaces.

## 🌟 Key Features

### 🔐 1. Asymmetric Envelope Encryption
The system enforces zero-knowledge storage where the backend never sees plaintext files.
- **AES-256-GCM:** Each file is streamed and symmetrically encrypted with a unique File Encryption Key (FEK) before uploading to Supabase.
- **RSA-2048 Asymmetric Wrapping:** The FEK is asymmetrically encrypted using the user's public key. The user's private key is symmetrically encrypted using a password-derived key and only unlocked in-memory during a session.
- **Data Integrity:** Files are validated using SHA-256 checksums to detect tampering.

### 🛡️ 2. Strict Role-Based Access Control (RBAC)
The platform enforces a strict separation of concerns across three distinct roles:
- **User:** Can upload files, decrypt/download files, and share files with other registered users (using public-key re-encryption). Only users consume storage quota (default 100MB).
- **Admin:** Lifecycle management. Admins view user rosters, monitor detailed audit logs of all user activities, and delete accounts. Admins cannot upload or access files.
- **Security Manager:** System surveillance. Can flag suspicious accounts, manage encryption keys (including triggering rotations), and toggle encryption policy parameters. Security Managers cannot upload or access files.

### 🔗 3. Secure Internal File Sharing
Users can seamlessly share encrypted files with other registered users without revealing their password or duplicating the file payload.
- The system temporarily decrypts the FEK using the owner's private key and immediately re-encrypts it using the recipient's public key.

### 👁️‍🗨️ 4. Immersive Dark UI Design
Built entirely using **React, Vite, and Tailwind CSS**.
- Features an electric dark aesthetic, utilizing `lucide-react` for iconography and `react-toastify` for real-time status alerts.
- Features context-aware navigation sidebars that dynamically adjust based on user role authorization.

---

## 🏗️ System Architecture

### Frontend (React + Vite)
- Context-driven State (`Zustand` manages auth states and session data).
- Axios Interceptors handling automatic token attachment and 401 redirection.
- Dedicated Route Protectors (`<ProtectedRoute>`) ensuring role-based access to the `Admin` and `Security Manager` dashboards.

### Backend (Node.js + Express + Prisma)
- **Database:** PostgreSQL accessed via Prisma Client.
- **File Storage:** Supabase Object Storage API.
- **Cryptography Layer:** Uses the native Node.js `crypto` module to handle FEK generation, streaming AES encryption, and RSA key operations.
- **Audit Logging:** Every sensitive API endpoint triggers an asynchronous `AuditService.logEvent` building a forensic trail of data access.

---

## ⚙️ Installation & Operation

### 1. Environment Setup

**Backend `.env`:**
Create a `.env` file in the `/backend` directory:
```env
PORT=5000
DATABASE_URL="postgresql://postgres:password@localhost:5432/securevault?schema=public"
JWT_SECRET=super_secret_jwt_key
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_BUCKET=secure_vault_encrypted_files
``` 

### 2. Booting the Servers

Run the backend:
```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Run the frontend:
```bash
cd frontend
npm install
npm run dev
```

### 3. First-Time Setup (Bootstrapping an Admin)
You can manually run the `makeAdmin.js` script to grant a user Admin privileges:
```bash
cd backend
node makeAdmin.js user@example.com Admin
```

---

## 📝 Audit & Compliance Capabilities
Every action within the system—from document uploads, failed login attempts, to specific document views—is captured securely in an immutable Audit table in PostgreSQL. Admins have complete visibility into the history of every active user via the Admin Console.
