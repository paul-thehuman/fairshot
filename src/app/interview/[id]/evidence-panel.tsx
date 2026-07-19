"use client";

import { useRef, useState } from "react";

// Shown on the pre-interview brief. Lets a founder share evidence before the
// assessment closes: a link we re-grade for real, or a file we store and show
// to the investor as self-attested.
export default function EvidencePanel({
  opportunityId,
  onUpdated,
}: {
  opportunityId: string;
  onUpdated: () => void;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submitUrl() {
    if (!/^https?:\/\//i.test(url.trim())) {
      setError("Enter a full link starting with http.");
      return;
    }
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId, url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not check that link");
      setNote(
        data.upgraded > 0
          ? `Checked. ${data.upgraded} claim${data.upgraded > 1 ? "s" : ""} now backed by your link.`
          : "Link saved. It didn't corroborate an open claim, but the investor will see you provided it."
      );
      setUrl("");
      onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const form = new FormData();
      form.append("opportunityId", opportunityId);
      form.append("file", file);
      const res = await fetch("/api/evidence", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setNote(`Added “${data.filename}”. The investor sees it, marked as provided by you.`);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <section className="nb-card-flat mt-5 p-4">
      <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--color-teal)]">
        Add evidence now
      </h3>
      <p className="mt-1 text-sm text-muted">
        Have proof to hand? Share it before we assess. A link we can open counts
        as independent evidence and can lift a claim on the spot. An upload is
        shown to the investor, marked as provided by you.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          className="nb-input flex-1 text-sm"
          placeholder="https://link-to-your-proof"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={busy}
        />
        <button
          type="button"
          onClick={submitUrl}
          disabled={busy || !url.trim()}
          className="nb-btn nb-btn-sm"
        >
          {busy ? "…" : "Add link"}
        </button>
      </div>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="nb-btn nb-btn-sm mt-2"
      >
        Upload screenshot or document
      </button>
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept="image/*,.pdf,.doc,.docx"
        onChange={submitFile}
      />
      {note && <p className="mt-2 text-sm font-medium text-[var(--color-teal)]">{note}</p>}
      {error && <p className="mt-2 text-sm text-[var(--color-error)]">{error}</p>}
    </section>
  );
}
