# FSWM (Faculty Schedule & Workload Manager)

![FSWM Banner](https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=1200)

**FSWM** is a robust, enterprise-grade web application tailored for higher education institutions to manage academic curriculum scheduling, faculty availability, facility room utilization, and instructional workload compliance.

Built specifically to streamline the multi-stage academic scheduling lifecycle, FSWM enforces strict separation of concerns across administrative roles, eliminating double-bookings, room over-capacity, and faculty workload overloads through real-time collision detection.

---

## 🌟 Key Features

### 🏛️ Master Data & Facilities Management
- **Campus Buildings & Rooms**: Maintain room inventories, occupancy capacities, and specialized equipment tags (e.g., Computer Labs, Multimedia Rooms).
- **Facility Blocking & Holds**: Reserve rooms for university events, maintenance, or administrative holds to prevent academic scheduling conflicts.
- **Academic Term Lifecycles**: Configure school years, semester date boundaries, active operating scopes, and term lock statuses.

### 👥 Role-Based Access Control (RBAC)
- **System Administrator**: Manages user accounts, active statuses, and assigns global or department-scoped operational roles.
- **University Registrar**: Configures master facilities, time slot matrices, room blocking, academic terms, and handles final schedule publishing.
- **Department Head**: Oversees departmental course offerings, faculty workload policies, drafts class schedules, and submits timetables for review.
- **Faculty Member**: Inputs personal teaching availability matrices, views published timetables, and submits formal schedule acknowledgements or revision requests.

### 📅 Advanced Schedule Drafting & Collision Engine
- **Interactive Schedule Editor**: Drag-and-drop or select rooms, time intervals, and instructors for subject offerings.
- **Real-Time Conflict Prevention**: Instant validation checks against instructor double-booking, room double-booking, seating capacity constraints, and maximum instructional workload unit limits.
- **Multi-Version Timetables**: Maintain draft, submitted, approved, and released versions of schedules with complete audit logs and revision histories.

---

## 💻 Technology Stack

- **Frontend & Framework**: [Next.js App Router](https://nextjs.org/) (React 18/19 Server Components & Server Actions)
- **Language**: TypeScript for end-to-end type safety
- **Styling**: Tailwind CSS & Lucide React Icons
- **Database**: PostgreSQL with raw SQL-first migrations (`pg` client)
- **Validation**: Zod schema validation and robust backend constraint checks

---

## 🚀 Getting Started Locally

### Prerequisites
- Node.js (v18+)
- PostgreSQL (v14+) running locally or via remote connection

### Installation & Setup

1. **Clone Repository & Install Dependencies**:
   ```bash
   git clone https://github.com/emlbahagan/FSWM.git
   cd FSWM
   npm install
   ```

2. **Environment Variables**:
   Create a `.env.local` file in the root directory and define your PostgreSQL database connection string:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/fswm"
   ```

3. **Run Database Migrations**:
   Execute the SQL migration scripts located in `database/migrations/` in ascending order (001 to 012) against your PostgreSQL instance to establish the schema, lookup tables, and initial seed data.

4. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser to access the portal.

---

## 🧪 Validation Commands

To verify code formatting, linting, and build readiness:

```bash
# Run ESLint validation
npm run lint

# Run Vitest test suites
npm run test

# Validate Next.js production build
npm run build
```

---

## 📄 License & Terms

FSWM is proprietary software developed for internal university academic operations and scheduling management. All rights reserved.
