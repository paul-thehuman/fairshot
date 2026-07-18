"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ScanReport } from "@/lib/pipeline";

export default function ScanButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<ScanReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch("/api/scan", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");
      setReport(data);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={run}
        disabled={running}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {running ? "Scanning channels…" : "Run outbound scan"}
      </button>
      {report && (
        <p className="max-w-md text-right text-xs text-neutral-500">
          {report.scanners
            .map((s) => `${s.source}: ${s.error ? "failed" : s.found}`)
            .join(" · ")}
          {" — "}
          {report.foundersCreated} new, {report.foundersMerged} merged,{" "}
          {report.screened} screened, {report.invited} invited
          {report.llmSkipped ? " (screening skipped: no LLM key)" : ""}
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
