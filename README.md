# Secure Data Vault (SDV)

![Secure Data Vault](https://img.shields.io/badge/Security-Advanced-blueviolet?style=for-the-badge)
![Encryption](https://img.shields.io/badge/Encryption-AES%20%7C%20ChaCha20%20%7C%20Camellia-blue?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-Backend-green?style=for-the-badge)
![React](https://img.shields.io/badge/React-Frontend-61DAFB?style=for-the-badge&logo=react)

The **Secure Data Vault** is an enterprise-grade, object-oriented system designed to securely encrypt, store, and manage highly sensitive text data and files. Built with a "Comprehensive Master Edition Dark UI", it features multi-algorithm encryption (via a Strategy Pattern), invite-only registration, strict Role-Based Access Control (RBAC), and a granular auditing and alert system to prevent data leakage.

## 🌟 Key Features

### 🔐 1. Multi-Algorithm Encryption Engine (Strategy Pattern)
The system supports 6 different encryption algorithms. Users can manually choose the algorithm they trust, or let the internal Engine dynamically select the best algorithm based on the data's **Sensitivity Level**.
- **Algorithms Supported:** AES-256-GCM, ChaCha20-Poly1305, Camellia-256-CFB, Twofish, ARIA, SEED.
- **Envelope Encryption**: Data encryption keys are stored encrypted at rest using a Master Encryption Key (MEK).

### 🚀 2. Invite-Only Enterprise Registration
To prevent unauthorized sign-ups, the application employs a highly restricted registration flow:
- **Admin Bootstrap:** The very first deployment boots with a special bypass: registering with `admin@psgitech.ac.in` automatically confers **Admin** privileges.
- **Whitelist System:** For all other users, Admins must proactively whitelist an email address and assign its role from the Admin Dashboard. Unauthorized emails are entirely blocked from viewing the vault.

### 🛡️ 3. Security, RBAC & Sensitivity Levels
Data is categorized natively by its sensitivity: `LOW`, `MEDIUM`, `HIGH`, or `CRITICAL`.
- **CRITICAL Restriction:** Critical items demand continuous reverification. They can never be shared externally and trigger instant audit alerts when viewed.
- **Login Protections:** Lock-outs after 5 failed attempts, suspicious IP geo-blocking, and explicit IP-whitelisting for enterprise environments.

### 🔗 4. Timed & Protected External File Sharing
Users can securely generate public URL links to share files temporarily without creating permanent backdoors.
- **Auto-Revocation**: Links self-destruct via TTL-indexing based on time constraints (e.g., 24 hours) or Max-Download limits.
- **Password Enforcement**: If the shared item is marked `HIGH` sensitivity, the system strictly forces a password overlay onto the public download link to prevent accidental exposure.

### 👁️‍🗨️ 5. Immersive Dark UI Design
Built entirely via vanilla CSS, the frontend uses a sophisticated 4-layer void depth system:
- **Void/Surface Layers**: Elements float on `#080810`, `#0f0f1a` base backgrounds.
- **Electric Aesthetics**: The UI avoids flat bright themes, instead employing `#7c5cfc` (Electric Violet) with dynamic box-shadow glows.
- **Animations:** All transitions strictly follow standard `cubic-bezier` spring easing. 

---

## 🏗️ System Architecture

### Frontend (React + Vite)
- Context-driven State (`AuthContext` manages JWTs and user states).
- Axios Interceptors handling automatic token attachment and 401 redirection.
- Dedicated Route Protectors (`<ProtectedRoute>`, `<PublicRoute>`, `<AdminRoute>`).

### Backend (Node.js + Express + Mongoose)
- **Envelope Cryptography Layer**: Contains `EncryptionEngine.js` handling dynamic IVs, tag generation, and payload wrapping.
- **Mongoose Middlewares**: `EncryptionKey`, `AuditLog`, `Session`, `Alert`, and TTL-timed `ShareLink` schemas.
- **RBAC**: Middleware functions dynamically authorize routes based on JWT extraction.

---

## ⚙️ Installation & Operation

### Prerequisites
- Node.js v16+
- MongoDB instance (Local or Atlas)


### 1. Environment Setup

**Backend `.env`:**
Create a `.env` file in the `/backend` directory:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/securevault
JWT_SECRET=super_secret_jwt_key
MASTER_ENCRYPTION_KEY=32byte_hexadecimal_string_for_MEK
``` *(Generate a 32-byte key for MEK: `crypto.randomBytes(32).toString('hex')`)*

### 2. Booting the Servers

Run the backend:
```bash
cd backend
npm install
npm run dev
```

Run the frontend:
```bash
cd frontend
npm install
npm run dev
```

### 3. First-Time Setup (Bootstrapping)
1. Go to `http://localhost:5173/register`
2. Enter the specific bootstrap email: `admin@psgitech.ac.in`
3. Enter a secure password (e.g. `Admin@12345`).
4. The system will bypass restrictions and grant you immediate **Admin** access.
5. In the Admin Dashboard, begin whitelisting new user emails so your student/professor base can safely register.

---

## 📝 Audit & Compliance Capabilities
Every action within the system—from document uploads, failed login attempts, to specific document views—is captured securely in an immutable Audit Collection. Admins have complete visibility into the history of every active user and object via the Admin Dashboard's `AuditLogs` tools.

---

> _This project was developed comprehensively to tackle advanced cybersecurity design patterns and modular OOP architectures._
