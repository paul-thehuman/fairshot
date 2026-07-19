"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEMO_COLD_START_APPLICATION } from "@/lib/seed/demo";

const inputClass =
  "w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2";

export default function ApplyPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [pitch, setPitch] = useState("");
  const [links, setLinks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadDemo() {
    setName(DEMO_COLD_START_APPLICATION.name);
    setCompany(DEMO_COLD_START_APPLICATION.company);
    setPitch(DEMO_COLD_START_APPLICATION.pitch);
    setLinks(DEMO_COLD_START_APPLICATION.links.join("\n"));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          company,
          pitch,
          links: links.split("\n").filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Application failed");
      router.push(`/interview/${data.interviewId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Application failed");
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <header className="mb-8">
        <p className="text-sm font-medium uppercase tracking-wide text-neutral-500">
          Apply for $100K
        </p>
        <h1 className="mt-1 text-2xl font-semibold">
          No gatekeeper. No network required.
        </h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          A deck and a company name is enough to start. What you tell us is
          checked against real evidence, and what can&rsquo;t be checked, you
          get to show us in a short interview. You&rsquo;ll see honest feedback
          either way.
        </p>
        <button
          type="button"
          onClick={loadDemo}
          className="mt-3 rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-400"
        >
          Load demo application (cold-start founder)
        </button>
      </header>

      <section className="mb-8 rounded-lg border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/40">
        <h2 className="text-sm font-semibold">Give us something we can check</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          The more of your pitch we can verify, the stronger it lands. Anything
          you can&rsquo;t show in public, you&rsquo;ll get to walk us through in the
          interview.
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          <li>
            <span className="font-medium">Working links beat descriptions.</span>{" "}
            <span className="text-neutral-600 dark:text-neutral-400">
              Product, repo, demo, a live page. Paste anything public.
            </span>
          </li>
          <li>
            <span className="font-medium">Numbers beat adjectives.</span>{" "}
            <span className="text-neutral-600 dark:text-neutral-400">
              &ldquo;40 paying users&rdquo; or &ldquo;300 on the waitlist&rdquo;
              tells us more than &ldquo;strong traction&rdquo;.
            </span>
          </li>
          <li>
            <span className="font-medium">Names we can verify.</span>{" "}
            <span className="text-neutral-600 dark:text-neutral-400">
              Customers, pilots, accelerators, employers, publications.
            </span>
          </li>
          <li>
            <span className="font-medium">Proof of what you did.</span>{" "}
            <span className="text-neutral-600 dark:text-neutral-400">
              Commits, designs, a thing with your name on it.
            </span>
          </li>
        </ul>
        <p className="mt-3 text-xs text-neutral-500">
          No links is genuinely fine. We never hold missing evidence against you;
          evidence we can check just earns more confidence.
        </p>
      </section>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="name">
              Your name
            </label>
            <input
              id="name"
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="company">
              Company name
            </label>
            <input
              id="company"
              className={inputClass}
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              required
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="pitch">
            Your pitch: what you&rsquo;ve built, and who you are. Be specific.
          </label>
          <textarea
            id="pitch"
            rows={8}
            className={inputClass}
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="links">
            Public links, if you have them (one per line). None is fine.
          </label>
          <textarea
            id="links"
            rows={3}
            className={inputClass}
            value={links}
            onChange={(e) => setLinks(e.target.value)}
            placeholder={"https://github.com/...\nhttps://yourproduct.com"}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {submitting ? "Checking your evidence…" : "Apply and start the interview"}
        </button>
      </form>

      {error && (
        <p className="mt-6 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-800">
          {error}
        </p>
      )}
    </main>
  );
}
