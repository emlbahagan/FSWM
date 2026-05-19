# 🤝 Contributing to FSWM (Faculty Schedule & Workload Manager)

Thank you for your interest in contributing to the **FSWM Portal**! 

This portal is a mission-critical scheduling platform built for modern academic planning. Because the core conflict prevention engine, transactional database operations, and role-based permissions must remain perfectly reliable, all contributions must adhere to the high-integrity engineering standards outlined in this guide.

---

## 🏛️ Project Architecture Overview

FSWM is designed around Next.js App Router (React Server Components) and a relational PostgreSQL database schema.

```mermaid
graph TD
    subgraph Client Panel
        UI[React Server Component Forms] -->|Server Actions| SA[actions.ts]
    end
    subgraph Backend Services
        SA -->|requireCurrentUser| Auth[Auth Guard Cache]
        SA -->|requireRole / requirePermission| RBAC[RBAC Access Checks]
        SA -->|withTransaction / transactionQuery| DB[(PostgreSQL Database)]
        SA -->|recordAuditLog| Audit[Audit Trail Recorder]
    end
```

### Key Architectural Guidelines
1. **Zero Client-Side State Dependency for Security**: All authorization, database queries, and transaction management must execute strictly server-side inside Server Actions (`"use server"`) or React Server Components.
2. **Memoized Session Loading**: Auth details should be queried using react `cache()` memoized wrappers within `current-user.ts`.
3. **Optimistic UI with Fallbacks**: Use Tailwind variables and clean CSS loading states for responsive, live user interactions.

---

## 💻 Local Environment Setup

### 1. Prerequisites
- **Node.js**: `v18.x` or higher (Active LTS recommended)
- **PostgreSQL**: `v14.x` or higher running locally or in a secure Docker container

### 2. Initial Setup
Clone the repository and install npm packages:
```bash
git clone https://github.com/emlbahagan/FSWM.git
cd FSWM
npm install
```

### 3. Environment Secrets
Create a `.env.local` file in the root directory (automatically ignored by Git):
```env
DATABASE_URL="postgresql://postgres:postgres_secure_password@localhost:5432/fswm"
SESSION_SECRET="generate-a-cryptographically-secure-32-byte-secret"
```

### 4. Database Migrations
Migrations in FSWM are SQL-first and chronological. Apply all scripts located in `database/migrations/` sequentially against your database:
```bash
# Example for applying files sequentially using psql CLI
psql -d fswm -f database/migrations/001_enable_extensions.sql
psql -d fswm -f database/migrations/002_lookup_tables.sql
...
psql -d fswm -f database/migrations/013_add_force_password_reset.sql
```

---

## 🛡️ Coding & Security Standards

To keep the platform robust, every developer must follow these four core programming paradigms:

### 1. Robust Server Action Error Handling
All Server Actions linked to forms **must** contain try/catch blocks that redirect errors back to the UI gracefully rather than raising uncaught exceptions (which triggers Next.js crash screens).

> [!IMPORTANT]
> Always let Next.js internal redirections (`NEXT_REDIRECT`) escape the catch block:
> ```typescript
> export async function myAction(formData: FormData) {
>   const currentUser = await requireCurrentUser();
>   requireRole(currentUser, RoleCode.Registrar);
> 
>   const someId = formData.get("someId")?.toString();
> 
>   try {
>     if (!someId) throw new Error("ID is required");
>     await query("DELETE FROM items WHERE id = $1", [someId]);
> 
>     revalidatePath("/dashboard/items");
>     redirect("/dashboard/items");
>   } catch (err: unknown) {
>     const errorObject = err as { message?: string; digest?: string };
>     // Crucial: Let Next.js handle its internal redirect throw
>     if (errorObject.digest?.startsWith("NEXT_REDIRECT")) {
>       throw err;
>     }
>     const msg = errorObject.message || "An unexpected error occurred.";
>     redirect(`/dashboard/items?error=${encodeURIComponent(msg)}`);
>   }
> }
> ```

### 2. Contextual UI Error Banners
UI pages that handle actions must extract error parameters from `searchParams` and display matching dismissible alert components:
* Use a dynamic alert header that matches the specific error class (e.g., `"Account Deletion Blocked"` vs `"Role Action Blocked"`).
* Avoid plain text headers. Leverage dynamic search params inspection:
  ```typescript
  let alertHeader = "Action Blocked";
  if (errorMsg) {
    const lower = errorMsg.toLowerCase();
    if (lower.includes("delete")) alertHeader = "Deletion Blocked";
    else if (lower.includes("role")) alertHeader = "Role Action Blocked";
  }
  ```

### 3. Comprehensive Audit Trail
Every data mutation must log an audit trail using the `recordAuditLog` helper:
```typescript
await recordAuditLog({
  actorUserId: currentUser.userId,
  actionCode: "ITEM_DELETED",
  moduleCode: "INVENTORY",
  targetTable: "items",
  targetId: someId,
  oldValueJson: { id: someId, name: item.name },
});
```

### 4. Strict Type Safety
- **No `any` usage**: Always declare exact TS types or interfaces.
- **Zod schemas**: Perform user-input schema validation for external parameters before committing queries to the database.

---

## 🧪 Testing & Validation

Before pushing any branches or opening a Pull Request, verify that all validation steps pass completely:

```bash
# 1. Run ESLint code checks
npm run lint

# 2. Execute unit and authorization tests
npm run test

# 3. Compile Next.js production bundle
npm run build
```

---

## 🌿 Git Flow & Branching Policies

FSWM follows a structured conventional commit flow:

### 1. Branch Naming Structure
- **Features**: `feature/your-feature-name` (e.g., `feature/dynamic-banners`)
- **Bug Fixes**: `bugfix/issue-description` (e.g., `bugfix/role-action-uncaught-errors`)
- **Refactoring**: `refactor/cleaned-component` (e.g., `refactor/auth-types`)

### 2. Conventional Commits Guide
Use clear, semantic commit messages:
- `feat(auth): add force password reset workflow`
- `fix(users): wrap server action updates in try-catch blocks`
- `docs(readme): update postgres requirements`

---

## 📝 Pull Request Checklist
Before submitting a pull request, verify that:
- [ ] No sensitive credentials, secrets, or local configuration files are tracked in Git (run `git status` to verify).
- [ ] All database migration scripts have been added as incremental `.sql` files in `database/migrations/`.
- [ ] `npm run lint` and `npm run test` execute cleanly with exit code 0.
- [ ] The Next.js production build passes with `npm run build`.
