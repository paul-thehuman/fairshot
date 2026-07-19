"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SourceInput() {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!handle.trim()) return;
    setRunning(true);
    setNote(null);
    try {
      const res = await fetch("/api/source-founder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ github: handle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sourcing failed");
      setNote(
        `Profiled from ${data.signalsAdded} real signals · conviction ${data.conviction ?? "—"} · interview invited`
      );
      setHandle("");
      router.refresh();
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Sourcing failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <form onSubmit={run} className="flex gap-2">
        <input
          className="nb-input w-44 text-sm"
          placeholder="GitHub handle…"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
        />
        <button
          type="submit"
          disabled={running || !handle.trim()}
          className="nb-btn nb-btn-sm"
        >
          {running ? "Profiling…" : "Source founder"}
        </button>
      </form>
      {note && <p className="max-w-xs text-right text-xs text-muted">{note}</p>}
    </div>
  );
}
