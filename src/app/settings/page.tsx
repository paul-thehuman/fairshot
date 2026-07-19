"use client";

import { useEffect, useState } from "react";
import type { Thesis } from "@/lib/types";

const inputClass = "nb-input";

export default function SettingsPage() {
  const [thesis, setThesis] = useState<Thesis | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/thesis")
      .then((r) => r.json())
      .then(setThesis);
  }, []);

  async function save() {
    if (!thesis) return;
    setSaving(true);
    setSaved(false);
    await fetch("/api/thesis", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(thesis),
    });
    setSaving(false);
    setSaved(true);
  }

  if (!thesis) {
    return <main className="mx-auto w-full max-w-2xl px-6 py-12">Loading thesis…</main>;
  }

  function setList(key: "sectors" | "stages" | "geographies", value: string) {
    setThesis((t) =>
      t ? { ...t, [key]: value.split(",").map((s) => s.trim()).filter(Boolean) } : t
    );
    setSaved(false);
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <header className="mb-8">
        <p className="text-sm font-bold uppercase tracking-wide text-[var(--color-main)]">
          Thesis engine
        </p>
        <h1 className="mt-1 text-3xl">What this fund invests in</h1>
        <p className="mt-2 text-muted">
          Every sourced founder, screen and memo is filtered and scored through this
          lens. Change it and the system changes with it.
        </p>
      </header>

      <div className="space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium">Sectors (comma-separated)</label>
          <input
            className={inputClass}
            value={thesis.sectors.join(", ")}
            onChange={(e) => setList("sectors", e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Stages</label>
          <input
            className={inputClass}
            value={thesis.stages.join(", ")}
            onChange={(e) => setList("stages", e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Geographies</label>
          <input
            className={inputClass}
            value={thesis.geographies.join(", ")}
            onChange={(e) => setList("geographies", e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Check size (USD)</label>
            <input
              type="number"
              className={inputClass}
              value={thesis.checkSizeUsd}
              onChange={(e) => {
                setThesis({ ...thesis, checkSizeUsd: Number(e.target.value) });
                setSaved(false);
              }}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Ownership target (%)</label>
            <input
              type="number"
              className={inputClass}
              value={thesis.ownershipTargetPct}
              onChange={(e) => {
                setThesis({ ...thesis, ownershipTargetPct: Number(e.target.value) });
                setSaved(false);
              }}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Risk appetite</label>
            <select
              className={inputClass}
              value={thesis.riskAppetite}
              onChange={(e) => {
                setThesis({
                  ...thesis,
                  riskAppetite: e.target.value as Thesis["riskAppetite"],
                });
                setSaved(false);
              }}
            >
              <option value="conservative">Conservative</option>
              <option value="balanced">Balanced</option>
              <option value="aggressive">Aggressive</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Conviction threshold (0-100)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              className={inputClass}
              value={thesis.convictionThreshold}
              onChange={(e) => {
                setThesis({ ...thesis, convictionThreshold: Number(e.target.value) });
                setSaved(false);
              }}
            />
            <p className="mt-1 text-xs text-muted">
              Outbound founders crossing this score are invited to interview.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving} className="nb-btn nb-btn-primary">
            {saving ? "Saving…" : "Save thesis"}
          </button>
          {saved && (
            <span className="text-sm font-semibold text-[var(--color-teal)]">Saved.</span>
          )}
        </div>
      </div>
    </main>
  );
}
