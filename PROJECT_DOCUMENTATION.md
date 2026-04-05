# Secure Data Vault (SDV) - Project Documentation
*Comprehensive Study Guide for Interview Preparation*

---

## 1. Project Background: Why This Project & The Problem It Solves

### The Problem
In modern data infrastructures, storing sensitive information (passwords, proprietary algorithms, financial documents, API keys) inside raw databases leaves them highly vulnerable to insider threats, SQL injections, and database dumps. Standard at-rest encryption (where the database encrypts the hard drive) is insufficient because a compromised application server or database admin still has raw access to the data in transit and at rest. Furthermore, organizations struggle to enforce strict access boundaries, temporary sharing, and verifiable audit trails for sensitive data objects.

### The Solution: Secure Data Vault 
This project was developed as an Object-Oriented, Context-Aware Encryption Vault. It moves encryption from the "Storage Layer" up into the "Application Layer". 
1. **Zero-Trust Storage:** The database never sees the raw data; it only stores ciphertexts. Even if the database is completely compromised, the data is unreadable without the respective Data Encryption Keys (DEKs).
2. **Access Security:** An isolated, invite-only Role-Based Access Control (RBAC) system manages the identities, meaning no open registration abuse.
3. **Advanced Architecture:** Utilizing the **Strategy Design Pattern**, the system can dynamically select between 6 different encryption algorithms based on the "Sensitivity Context" of the data, rather than hardcoding a single method.

---

## 2. Core Functionalities & System Flow

### System Flow Overview
1. **Authentication:** The user logs in via the React frontend. The Node.js backend validates credentials against the `User` document and returns a JSON Web Token (JWT).
2. **Authorization Constraint:** The user's role (Admin, Student, Professor) determines their API access layer. An Admin explicitly manages the `AuthorizedEmail` whitelist which governs who can enter the system.
3. **Data Ingestion:** When a user uploads a file or writes a secret note, they assign it a Sensitivity Level (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
4. **Context-Aware Encryption:** The `EncryptionEngine` evaluates the sensitivity and invokes the appropriate Encryption Strategy (e.g., ChaCha20 for Mobile/Fast payloads, AES-256 for Critical data).
5. **Envelope Encryption:** The payload is encrypted with a unique, randomly generated Data Encryption Key (DEK). That DEK is then encrypted by the Master Encryption Key (MEK) and stored securely in the `EncryptionKey` collection.
6. **Auditing:** Every single read, write, decryption, and failed login logs a permanent entry in the `AuditLog` collection.
7. **Ephemeral Sharing:** If authorized, a user can generate a `ShareLink` for a specific item. The backend generates a cryptographically secure 48-byte token, restricts it by TTL (Time-To-Live) or max downloads, and exposes it publicly. If the file is `HIGH` sensitivity, an ad-hoc password gate is injected into the request flow.

### Detailed Component Explanations
* **Auth System:** Built on JWTs. Includes defensive measures like IP tracking, geometric lockouts (e.g., 5 failures = 15 minute lock), and alerting logic.
* **Mongoose Data Models:** Uses references and cascading deletes (when a user is removed, all their vault items, folders, and keys are scrubbed).
* **Security & Auditing:** The system tracks `userAgent` parsing to detect new devices, firing alerts if a login occurs from an unrecognized IP space.
* **Master Edition Dark UI:** The frontend doesn't rely on generic libraries like Bootstrap. It uses a custom 4-layer void depth system with vanilla CSS relying heavily on CSS Variables, custom `cubic-bezier` spring animations, and strict `backdrop-filter` glassmorphism to look highly sophisticated.

---

## 3. Development Challenges & Technical Resolutions
*(Be prepared to discuss these when asked about "Difficulties you faced")*

### Challenge 1: Encryption Key Management & Database Compromise
**The Issue:** If we use a single encryption password for all data, a leak of that password compromises the entire vault. If we generate unique keys for every file, where do we securely store thousands of keys?
**The Resolution:** We implemented the **Envelope Encryption Architecture**. We encrypt the data with unique Data Encryption Keys (DEKs). We then encrypt those DEKs using a single highly-secured Master Encryption Key (MEK) stored only in the server's environment variables. The encrypted DEKs are then stored alongside the ciphertext in the database. This allows us to rapidly rotate the MEK without needing to re-encrypt gigabytes of actual vault data.

### Challenge 2: Dynamic Algorithm Swapping in Node.js
**The Issue:** Wrapping Nodes' `crypto` module to handle distinct algorithms (AES, ChaCha, Camellia) dynamically resulted in a massive, unreadable `if/else` block. Different algorithms require different Initialization Vector (IV) lengths and some require Authentication Tags (GCM) while others don't (CBC).
**The Resolution:** We implemented the **Strategy Design Pattern** (Object-Oriented Design). We created abstract interfaces and specific classes for each algorithm (e.g., `AESStrategy`, `ChaCha20Strategy`). The `EncryptionEngine` simply accepts a payload and an injected Strategy instance. It inherently solved the differing IV/Tag issues via polymorphism, making the code clean and scalable.

### Challenge 3: Securely Cleaning Up Expired Share Links
**The Issue:** We built timed shareable links. Initially, we used a `setInterval` worker running every 10 minutes to delete expired links in MongoDB. This caused performance spikes and occasionally allowed users to access a link 9 minutes after it supposedly expired.
**The Resolution:** We shifted the responsibility directly to the database layer by implementing **MongoDB TTL (Time-To-Live) Indexes**. We set an `expiresAt` date on the `ShareLink` schema, and Mongo's background thread automatically drops the document. To completely fix the "grace period" gap, we also implemented an "Active Evaluation" in the API route: if a user hits the route, we check `if (new Date() > link.expiresAt) throw Error()`. This combined passive DB cleanup with active API enforcement.

### Challenge 4: React State Desync with Heavily Nested Modals
**The Issue:** In the UI, the Share Modal, Decrypt Modal, and Editing Modals were buried inside individual Vault Item card components. Rendering 100 cards meant rendering 300 hidden modals, causing massive DOM bloating and React performance issues (lagging typing inputs).
**The Resolution:** We lifted the modal states up to the parent component (`VaultItems.jsx`) and used a single shared instance of the Modal. By passing the "Active Item ID" to the state, we went from rendering hundreds of invisible modals to just one dynamic one, optimizing frontend memory usage drastically.

---

## 4. Key Terminology to Use in the Interview
- **RBAC (Role-Based Access Control):** "We didn't just have an API; we gated the architecture logically so Admins, Professors, and Students have physically different route permissions."
- **Envelope Encryption:** "Data is encrypted by DEKs; DEKs are encrypted by the MEK. This ensures rapid key rotation."
- **Strategy Pattern:** "We utilized OOP behavioral patterns to dynamically hot-swap encryption algorithms at runtime without changing the consuming client code."
- **TTL Indexing:** "We used MongoDB native features to offload cleanup tasks, reducing Node.js event loop blocking."
- **Geospatial & IP Security:** "The system observes user anomalies. If a user logs in from a new IP space, not only do we log it, we generate an internal Security Alert."

---

## 5. Potential Interview Questions to Practice
1. *How did you ensure that if an attacker dumped your MongoDB database, the data was still safe?*
2. *Why did you roll your own CSS for the Master UI edition instead of using Tailwind or Material-UI?*
3. *Can you explain how JSON Web Tokens (JWT) are being used for authentication in your project? What happens if a token is stolen?*
4. *How does the system differentiate between a HIGh sensitivity file and a CRITICAL sensitivity file?*
5. *Explain how you manage state React side for things like active user sessions and modal displays.*
