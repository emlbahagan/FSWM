"use client";

import { useState } from "react";
import { Sparkles, Check, AlertTriangle, AlertCircle, RefreshCw, X, ArrowRight, Play, Trash2, CheckCircle } from "lucide-react";
import { autoScheduleAction, commitAutoScheduleAction, rollbackAutoScheduleAction } from "./actions";
import { useRouter } from "next/navigation";

type AutoScheduleAssistantProps = {
  scheduleVersionId: string;
  stats: {
    unresolvedCount: number;
    activeRoomsCount: number;
    availableFacultyCount: number;
    hasTimeSlots: boolean;
  };
};

type Step = "CHECK" | "PREFERENCES" | "RUNNING" | "RESULTS";

type UnresolvedOffering = {
  subjectCode: string;
  subjectTitle: string;
  sectionCode: string;
  reason: string;
};

type RunResult = {
  totalOfferings: number;
  scheduledOfferings: number;
  unresolvedOfferings: UnresolvedOffering[];
  backupVersionId: string;
};

export default function AutoScheduleAssistant({ scheduleVersionId, stats }: AutoScheduleAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<Step>("CHECK");
  const [prioritizeDept, setPrioritizeDept] = useState(true);
  const [maximizeRoomEfficiency, setMaximizeRoomEfficiency] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const router = useRouter();

  const handleOpen = () => {
    setIsOpen(true);
    setStep("CHECK");
    setErrorMessage("");
    setResult(null);
  };

  const handleClose = () => {
    // If we have a pending backup and the user just closes the modal, discard it automatically for safety
    if (result?.backupVersionId) {
      handleDiscard();
    } else {
      setIsOpen(false);
    }
  };

  const handleRun = async () => {
    setStep("RUNNING");
    setErrorMessage("");
    try {
      const res = await autoScheduleAction(scheduleVersionId, prioritizeDept, maximizeRoomEfficiency);
      if (res.success && res.backupVersionId) {
        setResult({
          totalOfferings: res.totalOfferings,
          scheduledOfferings: res.scheduledOfferings,
          unresolvedOfferings: res.unresolvedOfferings,
          backupVersionId: res.backupVersionId,
        });
        setStep("RESULTS");
      } else {
        throw new Error("Failed to initialize scheduling session.");
      }
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(error.message || "An unexpected error occurred during draft schedule generation.");
      setStep("CHECK");
    }
  };

  const handleKeep = async () => {
    if (!result?.backupVersionId) return;
    setLoading(true);
    try {
      await commitAutoScheduleAction(scheduleVersionId, result.backupVersionId);
      setIsOpen(false);
      router.refresh();
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage("Failed to save draft assignments: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDiscard = async () => {
    if (!result?.backupVersionId) return;
    setLoading(true);
    try {
      await rollbackAutoScheduleAction(scheduleVersionId, result.backupVersionId);
      setResult(null);
      setIsOpen(false);
      router.refresh();
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage("Failed to discard changes safely: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const readyToRun = stats.hasTimeSlots && stats.activeRoomsCount > 0 && stats.unresolvedCount > 0;

  return (
    <>
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--teal)] to-cyan-600 dark:from-[var(--teal)]/80 dark:to-cyan-700/80 px-4 py-2 text-xs font-semibold text-white shadow-md hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer"
      >
        <Sparkles size={14} className="animate-pulse" /> Auto-Schedule Assistant
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="relative w-full max-w-xl rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-2xl space-y-6 max-h-[85vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-[var(--teal)]/10 p-2 text-[var(--teal)]">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">Auto-Schedule Assistant</h3>
                  <p className="text-xs text-[var(--muted)]">Generate conflict-free drafts in seconds.</p>
                </div>
              </div>
              <button
                disabled={loading}
                onClick={handleClose}
                className="rounded-md p-1 text-[var(--muted)] hover:bg-background transition"
              >
                <X size={18} />
              </button>
            </div>

            {errorMessage && (
              <div className="rounded-lg border border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 dark:border-rose-800/50 p-4 text-xs flex items-start gap-2.5">
                <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                <div className="text-rose-800 dark:text-rose-400">
                  <p className="font-semibold">Operation Failed</p>
                  <p className="mt-1 font-mono text-[11px]">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Step 1: Precondition Check */}
            {step === "CHECK" && (
              <div className="space-y-5">
                <div className="rounded-lg border border-[var(--line)] bg-background/50 p-4 space-y-3">
                  <h4 className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">Pre-flight System Checklist</h4>
                  
                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--muted)]">Curriculum Offerings to Schedule:</span>
                      <span className={`font-mono font-bold ${stats.unresolvedCount > 0 ? "text-amber-500" : "text-emerald-500"}`}>
                        {stats.unresolvedCount} remaining
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[var(--muted)]">Active Classrooms Configured:</span>
                      <span className={`font-mono font-bold ${stats.activeRoomsCount > 0 ? "text-emerald-500" : "text-rose-500"}`}>
                        {stats.activeRoomsCount} rooms
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[var(--muted)]">Faculty with Active Availabilities:</span>
                      <span className={`font-mono font-bold ${stats.availableFacultyCount > 0 ? "text-emerald-500" : "text-amber-500"}`}>
                        {stats.availableFacultyCount} instructors
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[var(--muted)]">Term Time Slot Intervals Setup:</span>
                      <span className={`font-mono font-bold ${stats.hasTimeSlots ? "text-emerald-500" : "text-rose-500"}`}>
                        {stats.hasTimeSlots ? "Ready" : "Not Enabled"}
                      </span>
                    </div>
                  </div>
                </div>

                {!readyToRun && (
                  <div className="rounded-lg bg-rose-50/50 dark:bg-rose-950/10 border border-rose-200/50 p-4 text-xs flex gap-2">
                    <AlertCircle size={16} className="text-rose-500 shrink-0" />
                    <p className="text-rose-700 dark:text-rose-400">
                      <strong>Auto-generation is disabled:</strong> Please configure active rooms, enabled time slots, and verify curriculum offerings before generating.
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={handleClose}
                    className="rounded-lg border border-[var(--line)] bg-transparent px-4 py-2 text-xs font-semibold text-foreground hover:bg-background transition"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!readyToRun}
                    onClick={() => setStep("PREFERENCES")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--teal)] px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[var(--teal)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                    Configure Preferences <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Preferences */}
            {step === "PREFERENCES" && (
              <div className="space-y-6 animate-fade-in">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">Scheduling Options</h4>
                  
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 rounded-lg border border-[var(--line)] bg-background/30 p-4 cursor-pointer hover:border-[var(--teal)]/50 transition">
                      <input
                        type="checkbox"
                        checked={prioritizeDept}
                        onChange={(e) => setPrioritizeDept(e.target.checked)}
                        className="rounded border-[var(--line)] text-[var(--teal)] focus:ring-[var(--teal)] mt-1 h-4 w-4 cursor-pointer"
                      />
                      <div>
                        <span className="text-xs font-bold text-foreground block">Prioritize Departmental Alignment</span>
                        <span className="text-[11px] text-[var(--muted)] mt-0.5 block">Assign department-based instructors to their corresponding offerings first.</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 rounded-lg border border-[var(--line)] bg-background/30 p-4 cursor-pointer hover:border-[var(--teal)]/50 transition">
                      <input
                        type="checkbox"
                        checked={maximizeRoomEfficiency}
                        onChange={(e) => setMaximizeRoomEfficiency(e.target.checked)}
                        className="rounded border-[var(--line)] text-[var(--teal)] focus:ring-[var(--teal)] mt-1 h-4 w-4 cursor-pointer"
                      />
                      <div>
                        <span className="text-xs font-bold text-foreground block">Optimize Classroom Allocation</span>
                        <span className="text-[11px] text-[var(--muted)] mt-0.5 block">Allocate classrooms with closer seating capacity margins to sections to preserve larger rooms.</span>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setStep("CHECK")}
                    className="rounded-lg border border-[var(--line)] bg-transparent px-4 py-2 text-xs font-semibold text-foreground hover:bg-background transition"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleRun}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--teal)] px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[var(--teal)]/90 transition cursor-pointer"
                  >
                    <Play size={12} /> Run Auto-Scheduler
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Running Progress Spinner */}
            {step === "RUNNING" && (
              <div className="flex flex-col items-center justify-center py-8 space-y-4 animate-fade-in">
                <RefreshCw size={40} className="animate-spin text-[var(--teal)]" />
                <div className="text-center">
                  <h4 className="font-bold text-sm text-foreground">Computing Constraint Matrix...</h4>
                  <p className="text-xs text-[var(--muted)] mt-1 max-w-sm">
                    Analyzing specialized faculty availability, classroom requirements, and room blocking to generate optimal schedule vectors.
                  </p>
                </div>
              </div>
            )}

            {/* Step 4: Results */}
            {step === "RESULTS" && result && (
              <div className="space-y-6 animate-fade-in">
                {/* Result Statistics Banner */}
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-5 text-center space-y-2">
                  <div className="inline-flex rounded-full bg-emerald-100 dark:bg-emerald-950 p-2 text-emerald-600">
                    <CheckCircle size={24} />
                  </div>
                  <h4 className="font-bold text-base text-foreground">Auto-Generation Complete!</h4>
                  <p className="text-xs text-[var(--muted)] max-w-sm mx-auto">
                    Successfully generated and scheduled <strong className="text-emerald-500">{result.scheduledOfferings} of {result.totalOfferings}</strong> unresolved offerings!
                  </p>
                </div>

                {/* Unresolved Classes Breakdown */}
                {result.unresolvedOfferings.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
                      <h4 className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">Unresolved Offering Sections ({result.unresolvedOfferings.length})</h4>
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-2 border border-[var(--line)] rounded-lg p-2 bg-background/50">
                      {result.unresolvedOfferings.map((unr, i) => (
                        <div key={i} className="rounded border border-[var(--line)] p-2.5 text-xs bg-background">
                          <div className="flex justify-between items-center font-bold">
                            <span className="text-[var(--teal)]">{unr.subjectCode} ({unr.sectionCode})</span>
                            <span className="text-[var(--muted)] text-[10px] truncate max-w-xs">{unr.subjectTitle}</span>
                          </div>
                          <p className="text-[10px] text-rose-500 mt-1">{unr.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-lg bg-amber-500/5 dark:bg-amber-950/10 border border-amber-500/20 p-4 text-[11px] text-amber-700 dark:text-amber-400 flex gap-2">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <p>
                    <strong>Preview State:</strong> The generated schedule assignments are saved temporarily for your preview. You can review them, run validation tests, and check reports. Click <strong>Apply</strong> to keep them, or <strong>Discard</strong> to revert to the previous state.
                  </p>
                </div>

                <div className="flex justify-between items-center gap-3 border-t border-[var(--line)] pt-4">
                  <button
                    disabled={loading}
                    onClick={handleDiscard}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 px-4 py-2.5 text-xs font-semibold transition cursor-pointer"
                  >
                    <Trash2 size={14} /> Discard & Revert
                  </button>
                  <button
                    disabled={loading}
                    onClick={handleKeep}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--teal)] px-5 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-[var(--teal)]/90 transition cursor-pointer"
                  >
                    <Check size={14} /> Keep & Apply Draft
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
