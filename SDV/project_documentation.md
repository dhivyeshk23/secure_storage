# SecureVault Enterprise - Comprehensive System Documentation

SecureVault Enterprise is a highly secure, role-based file storage and sharing platform. The system is designed to provide cryptographic guarantees around data confidentiality and integrity while enforcing strict Role-Based Access Control (RBAC) across distinct administrative duties.

---

## 1. System Architecture & Tech Stack

### 1.1 Backend
*   **Runtime:** Node.js with Express.js
*   **Database ORM:** Prisma Client
*   **Database:** PostgreSQL
*   **File Storage:** Supabase Storage (Object Storage)
*   **Authentication:** JWT (JSON Web Tokens) with HttpOnly cookies
*   **Cryptography:** Node.js native `crypto` module (AES-256-GCM, RSA-2048, SHA-256)

### 1.2 Frontend
*   **Framework:** React (Vite)
*   **State Management:** Zustand (`useAuthStore`)
*   **Styling:** Tailwind CSS + custom UI components (lucide-react icons)
*   **Data Fetching:** Axios (with interceptors) and TanStack React Query

---

## 2. Cryptographic Architecture (Envelope Encryption)

SecureVault guarantees that the server and storage providers (Supabase) cannot read user files, utilizing an **Envelope Encryption** architecture combined with **Asymmetric Key Sharing**:

### 2.1 User Keypair Generation
During registration (`authController.js`), every user is assigned an RSA-2048 keypair.
1.  **Public Key:** Stored in plaintext in the database.
2.  **Private Key:** Encrypted symmetrically using a derivative of the user's plaintext password + a unique salt, then stored in the database. The raw password is *never* stored, only a bcrypt hash for login verification.

### 2.2 File Upload & Encryption Flow (`fileController.js`)
When a user uploads a file:
1.  **FEK Generation:** A unique File Encryption Key (FEK) is generated using `crypto.randomBytes(32)`.
2.  **Streaming Encryption:** The file is streamed through an AES-256-GCM cipher using the FEK and a random Initialization Vector (IV).
3.  **Supabase Upload:** The resulting ciphertext is uploaded directly to the Supabase storage bucket.
4.  **Envelope Wrapping:** The FEK is encrypted asymmetrically using the uploading user's **Public Key**.
5.  **Metadata Storage:** The encrypted FEK, the Supabase path, file metadata, and a SHA-256 checksum are stored in the PostgreSQL database.

### 2.3 File Download & Decryption Flow
When a user downloads a file:
1.  **Key Unwrap:** The user provides their password via the `x-vault-password` header.
2.  The backend uses the password to decrypt the user's stored **Private Key**.
3.  The backend uses the Private Key to decrypt the **Encrypted FEK**.
4.  **Decryption:** The encrypted file is fetched from Supabase, streamed through an AES-256-GCM decipher using the decrypted FEK, and piped directly to the user as a downloadable file.

### 2.4 File Sharing
When User A shares a file with User B:
1.  User A provides their password to unlock their Private Key.
2.  User A's Private Key decrypts the file's FEK.
3.  The system re-encrypts the FEK using **User B's Public Key**.
4.  A new `EncryptedKey` record and a `Share` record are created in the database, granting User B cryptographic access to the exact same file payload in Supabase without duplicating the file.

---

## 3. Role-Based Access Control (RBAC)

The system isolates capabilities based on three primary roles:

### 3.1 "User" Role
*   **Capabilities:** Can upload files, download files, and share files with other registered users.
*   **Resources:** Users are the only accounts tracked for storage capacity (default 100MB quota).
*   **Interface:** `Dashboard.jsx` — Displays a file dropzone, storage usage bars, and a list of managed files with download/share/delete functions.

### 3.2 "Admin" Role
*   **Capabilities:** Lifecycle management of user accounts. Admins can view the user roster, check detailed user profiles, inspect granular activity logs of specific users, and delete accounts.
*   **Exclusions:** Admins cannot upload or share files, ensuring administrative accounts aren't used for personal storage.
*   **Interface:** `AdminDashboard.jsx` — Displays a master list of users. Clicking a user drills down into an audit view of their activity.

### 3.3 "Security Manager" Role
*   **Capabilities:** System surveillance and cryptographic policy control. Security Managers can view active users and flag suspicious accounts, manage encryption keys (including triggering rotations), and toggle encryption policy parameters.
*   **Exclusions:** Like Admins, they cannot upload files.
*   **Interface:** `SecurityManagerDashboard.jsx` — Segmented into tabs: Monitoring (flagging users), Encryption Keys (managing FEKs), and Policies.

---

## 4. System Components & Flow

### 4.1 Core Backend Services
*   **`CryptoService.js`:** The cryptographic utility module. It centralizes RSA key generation, AES stream cipher configurations, and key wrapping logic.
*   **`AuditService.js`:** The logging engine. It inserts records into the `AuditLog` table for every significant action (Login, Upload, Share, Download, Account Flagging, etc.) ensuring total system accountability.

### 4.2 API Controllers
*   **`authController.js`:** Handles `/register`, `/login`, `/me`, and `/logout`. Manages JWT issuance and RSA keypair setup.
*   **`fileController.js`:** Handles quota calculations, chunked/streamed encryption, Supabase I/O, and secure sharing logic.
*   **`adminController.js`:** Aggregates system statistics (total users, total files, total storage) and processes account deletion routines.
*   **`securityManager.js`:** Provides routes for flagging user accounts, fetching encryption key metadata, and simulating policy toggles.

### 4.3 Database Schema (Prisma)
*   **`User`**: Core identity, bcrypt password hash, encrypted private key, public key.
*   **`Role` / `UserRole`**: Maps users to their RBAC permissions.
*   **`File`**: Represents a physical file in Supabase. Contains metadata (size, original name, checksum) and owner relationship.
*   **`EncryptedKey`**: Represents an Envelope-encrypted FEK. Linked to a specific File and a specific User.
*   **`Share`**: Logical representation of file-sharing permissions (e.g., VIEW, DOWNLOAD).
*   **`StorageQuota`**: Limits how many bytes a User can upload.
*   **`AuditLog`**: Immutable ledger of user actions.

### 4.4 Frontend Architecture
*   **State (`store/authStore.js`):** Interacts with the backend `/me` endpoint on startup to establish the session. It exposes the current user's role and data to the component tree.
*   **Routing (`App.jsx`):** Uses React Router. The `<ProtectedRoute>` wrapper intercepts requests, checking both authentication presence and RBAC role arrays before rendering specific dashboards.
*   **Modals:** All sensitive actions (e.g., File Download, Sharing) trigger custom modal overlays that prompt the user for their account password to unlock their private key in memory.

---

## 5. Security Posture & Best Practices Implemented

1.  **Zero Knowledge Principle:** The server only possesses encrypted Private Keys and encrypted FEKs. Unless the user actively supplies their plaintext password during an active session request, the server cannot read the files.
2.  **In-Memory Password Processing:** The `x-vault-password` header is used dynamically to decrypt keys during the request lifecycle. The plaintext password is never cached or persisted to disk.
3.  **Strict Boundary Separation:** Admin and Security Manager functions are totally decoupled. An Admin cannot rotate keys, and a Security Manager cannot delete accounts.
4.  **Rate Limiting & Security Headers:** `express-rate-limit` prevents brute-forcing, while `helmet` secures HTTP headers against XSS and clickjacking.
5.  **Audit Trails:** Every sensitive API endpoint triggers an asynchronous `AuditService.logEvent` call, building a forensic trail of data access.
