# SecureVault — Security Manager & Admin Enhancements

## Summary of Changes

### 🛡️ Security Manager Role — New Page (`/security-manager`)

**Three-tab dashboard:**

| Tab | Features |
|-----|----------|
| **Users & Monitoring** | Lists all users with search, shows file counts/activity counts/flags. Click any user to see full detail view with files, activity logs, shares, and flag/unflag capability |
| **Encryption Keys** | Lists all encryption keys with file/user/algorithm info. Rotate individual keys or bulk rotate all at once |
| **Encryption Policies** | Configure all 6 encryption algorithms (AES-256-GCM, AES-256-CBC, AES-192-CBC, AES-128-CBC, ChaCha20-Poly1305, Triple-DES). Enable/disable each, set key rotation intervals |

**User Detail View includes:**
- Profile header with roles and status
- Flag/unflag button with reason modal
- Stats cards (files, activities, shares)
- Files list with sizes and encryption algorithms
- Full activity log table

### 👑 Admin Role — Updated Page (`/admin`)

| Feature | Description |
|---------|-------------|
| **Stats Cards** | Total users, files, storage, security events |
| **Pending Approvals** | Approve users with role assignment (unchanged) |
| **User Accounts Table** | NEW — Shows all users with roles, status, flag status (from security manager), file count, join date, and **Remove** button |
| **Security Logs** | REMOVED per request |

### 📁 Files Changed

#### Backend
| File | Change |
|------|--------|
| [securityManager.js](file:///d:/oose_security_project/SDV/backend/routes/securityManager.js) | **NEW** — 10 API endpoints for security manager |
| [adminController.js](file:///d:/oose_security_project/SDV/backend/controllers/adminController.js) | Added `getAllUsers` and `deleteUser` |
| [admin.js](file:///d:/oose_security_project/SDV/backend/routes/admin.js) | Added routes for `/all-users` and `DELETE /users/:userId` |
| [server.js](file:///d:/oose_security_project/SDV/backend/server.js) | Registered `/api/security-manager` routes, added `x-vault-password` to CORS |

#### Frontend
| File | Change |
|------|--------|
| [SecurityManagerDashboard.jsx](file:///d:/oose_security_project/SDV/frontend/src/pages/SecurityManagerDashboard.jsx) | **NEW** — Full security manager page |
| [AdminDashboard.jsx](file:///d:/oose_security_project/SDV/frontend/src/pages/AdminDashboard.jsx) | Replaced audit logs with user accounts table + delete |
| [App.jsx](file:///d:/oose_security_project/SDV/frontend/src/App.jsx) | Added `/security-manager` route |
| [Layout.jsx](file:///d:/oose_security_project/SDV/frontend/src/components/Layout.jsx) | Separate sidebar links for Admin Console & Security Manager |

### 🔌 New API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/security-manager/users` | List all users with stats & flags |
| GET | `/api/security-manager/users/:userId` | User detail with activities |
| POST | `/api/security-manager/flag-user` | Flag an account |
| POST | `/api/security-manager/unflag-user` | Remove flag |
| GET | `/api/security-manager/encryption-keys` | List encryption keys |
| POST | `/api/security-manager/rotate-key/:keyId` | Rotate single key |
| POST | `/api/security-manager/rotate-all-keys` | Bulk rotate all keys |
| GET | `/api/security-manager/encryption-policies` | List encryption policies |
| PUT | `/api/security-manager/encryption-policies/:id` | Update policy |
| GET | `/api/admin/all-users` | Admin: list all users with flags |
| DELETE | `/api/admin/users/:userId` | Admin: delete user account |
