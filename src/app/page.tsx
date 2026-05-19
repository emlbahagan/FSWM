import Link from "next/link";
import { BookOpen, Lock, User, Heart, Shield, Sparkles, Layers, ArrowRight } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-[var(--teal)]/20">
      {/* Pristine Light/Dark Header */}
      <header className="sticky top-0 z-50 bg-[var(--panel)]/80 backdrop-blur-md border-b border-[var(--line)] transition-theme">
        <div className="mx-auto max-w-7xl px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--teal)] flex items-center justify-center text-white shadow-md font-bold">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-foreground tracking-tight">
              FSWM
            </span>
          </div>

          <div className="flex items-center gap-4">
            <ThemeToggle />

            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--teal)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-all cursor-pointer"
            >
              <User className="w-4 h-4" /> Login
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section exactly matching mockup */}
      <main className="flex-1 flex flex-col justify-center relative overflow-hidden pt-12 pb-24 lg:pt-20 lg:pb-32">
        {/* Subtle decorative glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-[var(--hero-glow)] rounded-full blur-3xl pointer-events-none -z-10 transform-gpu" />

        <div className="mx-auto max-w-7xl px-6 w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            {/* Left Column: Welcome Text */}
            <div className="space-y-6 text-left max-w-2xl z-10">
              <div className="inline-flex items-center gap-2 font-bold text-xs tracking-[0.25em] text-[var(--muted)] uppercase">
                <span>WELCOME TO</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.15]">
                Faculty Scheduling & Workload Management System
              </h1>

              {/* Ornamental underline accent matching mockup */}
              <div className="flex items-center gap-2 pt-1 pb-2">
                <div className="h-1 w-16 bg-[var(--teal)] rounded-full" />
                <div className="h-1 w-1 bg-[var(--teal)] rounded-full" />
              </div>

              <p className="text-lg sm:text-xl text-[var(--muted)] font-medium leading-relaxed">
                Streamlining schedules. Balancing workloads. Supporting excellence.
              </p>

              <div className="pt-4 flex flex-wrap items-center gap-4">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--teal)] px-8 py-4 text-base font-semibold text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer"
                >
                  <Lock className="w-5 h-5" /> Login to System
                </Link>

                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-6 py-4 text-base font-semibold text-foreground shadow-2xs hover:border-[var(--teal)] transition-all cursor-pointer"
                >
                  Enter Dashboard <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Right Column: Elegant Desk Illustration matching mockup */}
            <div className="flex justify-center items-center relative py-6">
              <div className="w-full max-w-lg aspect-[4/3] relative flex items-center justify-center">
                {/* Custom SVG Vector Illustration representing the window, plant, laptop, and books */}
                <svg
                  viewBox="0 0 600 450"
                  className="w-full h-auto text-[var(--muted)] drop-shadow-xl transition-all duration-500"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* Arched Window in background */}
                  <path
                    d="M 370 250 V 90 A 80 80 0 0 1 530 90 V 250 Z"
                    className="stroke-[var(--line)] fill-[var(--panel)]"
                    strokeWidth="4"
                  />
                  <line x1="450" y1="10" x2="450" y2="250" className="stroke-[var(--line)]" strokeWidth="3" />
                  <line x1="370" y1="130" x2="530" y2="130" className="stroke-[var(--line)]" strokeWidth="3" />
                  
                  {/* Soft clouds inside window */}
                  <path d="M 380 160 Q 395 145 410 160 Q 425 150 440 165" className="fill-current opacity-10" />
                  <circle cx="495" cy="180" r="25" className="fill-current opacity-10" />
                  <circle cx="510" cy="210" r="30" className="fill-current opacity-10" />

                  {/* Desk Surface */}
                  <path d="M 50 320 L 550 320 L 590 380 L 10 380 Z" className="fill-[var(--panel)] stroke-[var(--line)]" strokeWidth="3" />
                  <line x1="10" y1="380" x2="590" y2="380" className="stroke-[var(--line)]" strokeWidth="2" />

                  {/* Potted Plant on left of desk */}
                  {/* Pot */}
                  <path d="M 180 270 L 220 270 L 215 310 L 185 310 Z" className="fill-[var(--panel)] stroke-current" strokeWidth="3" />
                  <ellipse cx="200" cy="270" rx="22" ry="6" className="fill-[var(--panel)] stroke-current" strokeWidth="3" />
                  {/* Leaves */}
                  <path d="M 200 270 Q 150 200 170 170 Q 190 200 200 270" className="fill-[var(--teal)] opacity-30 stroke-current" strokeWidth="2" />
                  <path d="M 200 270 Q 210 170 230 150 Q 240 190 200 270" className="fill-[var(--teal)] opacity-40 stroke-current" strokeWidth="2" />
                  <path d="M 200 270 Q 260 210 270 200 Q 250 240 200 270" className="fill-[var(--teal)] opacity-25 stroke-current" strokeWidth="2" />
                  <path d="M 200 270 Q 140 230 135 220 Q 160 250 200 270" className="fill-[var(--teal)] opacity-35 stroke-current" strokeWidth="2" />
                  <path d="M 200 270 Q 150 260 145 270 Q 170 285 200 270" className="fill-[var(--teal)] opacity-20 stroke-current" strokeWidth="2" />

                  {/* Modern Open Laptop in center */}
                  {/* Screen Backing */}
                  <path d="M 280 310 L 330 190 L 460 180 L 410 310 Z" className="fill-[var(--panel)] stroke-current" strokeWidth="4" />
                  {/* Apple/Logo on back of screen */}
                  <circle cx="380" cy="245" r="8" className="fill-[var(--teal)] opacity-40" />
                  {/* Base/Keyboard */}
                  <path d="M 240 330 L 420 310 L 450 335 L 255 350 Z" className="fill-[var(--panel)] stroke-current" strokeWidth="4" />
                  <path d="M 270 332 L 410 316 L 425 328 L 280 342 Z" className="fill-current opacity-15" />

                  {/* Stack of Books on right */}
                  {/* Book 1 bottom */}
                  <rect x="470" y="295" width="85" height="15" rx="2" className="fill-[var(--panel)] stroke-current" strokeWidth="3" transform="rotate(-3 470 295)" />
                  <line x1="472" y1="302" x2="552" y2="298" className="stroke-current opacity-30" strokeWidth="2" />
                  {/* Book 2 top */}
                  <rect x="475" y="280" width="78" height="14" rx="2" className="fill-[var(--teal)] opacity-20 stroke-current" strokeWidth="3" transform="rotate(-5 475 280)" />
                  <line x1="477" y1="287" x2="550" y2="281" className="stroke-current opacity-40" strokeWidth="2" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="mx-auto max-w-7xl px-6 w-full mt-24 pt-16 border-t border-[var(--line)]">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-8 shadow-xs hover:border-[var(--teal)] transition-all">
              <div className="w-12 h-12 rounded-xl bg-[var(--teal)]/10 text-[var(--teal)] flex items-center justify-center mb-6">
                <Sparkles size={24} />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Automated Optimization</h3>
              <p className="text-sm text-[var(--muted)] leading-relaxed">
                Real-time clash detection instantly identifies faculty double-bookings and room capacity constraints before schedules are finalized.
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-8 shadow-xs hover:border-[var(--teal)] transition-all">
              <div className="w-12 h-12 rounded-xl bg-[var(--teal)]/10 text-[var(--teal)] flex items-center justify-center mb-6">
                <Shield size={24} />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Workload Compliance</h3>
              <p className="text-sm text-[var(--muted)] leading-relaxed">
                Equitably distribute teaching units. Ensure full adherence to departmental workload policies and maximum instructional ceilings.
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-8 shadow-xs hover:border-[var(--teal)] transition-all">
              <div className="w-12 h-12 rounded-xl bg-[var(--teal)]/10 text-[var(--teal)] flex items-center justify-center mb-6">
                <Layers size={24} />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Multi-Tier Approval Flow</h3>
              <p className="text-sm text-[var(--muted)] leading-relaxed">
                Seamless coordination from faculty availability submissions to department head drafts and final registrar publication.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Beautiful Soft Wave Divider matching mockup */}
      <div className="w-full overflow-hidden leading-none text-[var(--panel)] bg-transparent">
        <svg
          className="relative block w-full h-16 sm:h-24 lg:h-32"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
        >
          <path
            d="M0,0 C150,90 350,-30 500,40 C650,110 900,10 1200,60 L1200,120 L0,120 Z"
            className="fill-[var(--panel)] border-t border-[var(--line)]/50"
          />
        </svg>
      </div>

      {/* Footer exactly matching mockup */}
      <footer className="bg-[var(--panel)] border-t border-[var(--line)] py-16 text-center transition-theme">
        <div className="mx-auto max-w-7xl px-6 flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[var(--teal)]/10 text-[var(--teal)] flex items-center justify-center mb-1 shadow-2xs">
            <Heart size={22} className="text-[var(--teal)]" />
          </div>

          <p className="text-base font-semibold text-foreground tracking-tight">
            Empowering educators. Enriching education.
          </p>

          <p className="text-xs text-[var(--muted)] mt-2 font-mono">
            &copy; {new Date().getFullYear()} Faculty Scheduling &amp; Workload Management System. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
