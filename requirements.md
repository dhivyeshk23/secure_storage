# SecureVault Enterprise - System Requirements

This document outlines the software, database, and library dependencies required to build, run, and maintain SecureVault Enterprise.

## 1. System Requirements
- **Operating System:** Windows, macOS, or Linux
- **Node.js:** v18.x or v20.x (LTS recommended)
- **Package Manager:** npm (v9+ recommended)

## 2. Infrastructure Requirements
- **PostgreSQL Database:** v14 or higher (Can be hosted locally or via a cloud provider like Supabase/Neon/AWS RDS).
- **Supabase Storage:** A Supabase account and project with an active Storage bucket (default bucket name: `secure_vault_encrypted_files`).

## 3. Backend Dependencies (`backend/package.json`)

### Core Framework & Server
- `express`: "^4.x" — Core web framework.
- `cors`: "^2.8.5" — Cross-Origin Resource Sharing.
- `dotenv`: "^16.x" — Environment variable loading.

### Security & Cryptography
- `bcryptjs`: "^2.4.x" — For hashing passwords prior to database storage.
- `jsonwebtoken`: "^9.x" — Issuing and verifying authentication tokens.
- `helmet`: "^7.x" — Setting secure HTTP headers.
- `express-rate-limit`: "^7.x" — Preventing brute force and DDoS attacks.
- `crypto`: (Built into Node.js) — AES-256-GCM and RSA operations.

### Database & Storage
- `@prisma/client`: "^5.x" — Type-safe database client.
- `prisma`: "^5.x" — Prisma CLI (used as a dev dependency for schema migrations).
- `@supabase/supabase-js`: "^2.x" — SDK for uploading and downloading encrypted files to Supabase object storage.

### Utilities
- `uuid`: "^9.x" — Generating unique identifiers for file storage.
- `multer`: "^1.4.x" — Handling `multipart/form-data` for file uploads.
- `winston`: "^3.x" — Enterprise-grade logging.
- `cookie-parser`: "^1.4.x" — Parsing HTTP cookies (for JWT).
- `compression`: "^1.7.x" — GZIP compression for API responses.

## 4. Frontend Dependencies (`frontend/package.json`)

### Core UI Framework
- `react`: "^18.x"
- `react-dom`: "^18.x"
- `react-router-dom`: "^6.x" — Client-side routing and protected routes.

### State Management & Data Fetching
- `zustand`: "^4.x" — Lightweight global state management (replaces Redux/Context).
- `@tanstack/react-query`: "^5.x" — Asynchronous state management and caching.
- `axios`: "^1.x" — HTTP client for API requests.

### Styling & UI Libraries
- `tailwindcss`: "^3.x" — Utility-first CSS framework for styling.
- `lucide-react`: "^0.x" — Modern, customizable SVG icons.
- `react-toastify`: "^9.x" — Toast notifications for success/error alerts.
- `date-fns`: "^3.x" — Utility for formatting timestamps.

### Build Tools (DevDependencies)
- `vite`: "^5.x" — Fast frontend build tool.
- `@vitejs/plugin-react`: "^4.x"
- `autoprefixer`: "^10.x"
- `postcss`: "^8.x"
