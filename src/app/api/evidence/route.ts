import { NextResponse } from "next/server";
import { submitFileEvidence, submitUrlEvidence } from "@/lib/submittedEvidence";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// One endpoint, two shapes. multipart/form-data => file upload; JSON => a link
// the founder wants checked. Both attach to an opportunity before assessment.
export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const opportunityId = String(form.get("opportunityId") || "");
      const file = form.get("file");
      if (!opportunityId || !(file instanceof File)) {
        return NextResponse.json(
          { error: "opportunityId and a file are required" },
          { status: 400 }
        );
      }
      if (file.size > 8 * 1024 * 1024) {
        return NextResponse.json({ error: "File too large (max 8MB)" }, { status: 400 });
      }
      const bytes = Buffer.from(await file.arrayBuffer());
      const result = await submitFileEvidence(opportunityId, file.name, bytes);
      return NextResponse.json({ kind: "file", ...result });
    }

    const body = (await req.json()) as { opportunityId?: string; url?: string };
    const opportunityId = String(body.opportunityId || "");
    const url = String(body.url || "").trim();
    if (!opportunityId || !/^https?:\/\//i.test(url)) {
      return NextResponse.json(
        { error: "opportunityId and a valid http(s) URL are required" },
        { status: 400 }
      );
    }
    const result = await submitUrlEvidence(opportunityId, url);
    return NextResponse.json({ kind: "url", ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Evidence submission failed" },
      { status: 500 }
    );
  }
}
