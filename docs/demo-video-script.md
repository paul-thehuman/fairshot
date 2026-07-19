# FairShot: tech video script

Target: 3 to 3.5 minutes. Screen recording of the app with your voice over it. Production setup first, then scene by scene. Narration lines are suggestions in your voice; make them yours.

## Before recording

1. Stop the dev server. Run a production build so it is fast and overlay-free: npm run build, then npm start.
2. Fresh data: curl -X POST localhost:3000/api/seed
3. Browser: hide the bookmarks bar, close spare tabs, 100% zoom, light or dark, your call.
4. Mic check, and have the Amara pitch ready to paste (the Load demo application button does it for you).
5. Have your spoken answer for Amara's first question ready, and say "the e-rostering guidance NHS England publishes" somewhere in it: that is the claim the live check will corroborate on camera.
6. Record at 1080p or better. OBS, Loom, or Windows Game Bar all fine.

## Scene 1: The problem (20s)

SCREEN: FairShot dashboard, freshly seeded.

NARRATION: "Right now, venture capital runs on networks. If a founder knows the right people, they get seen. If they don't, their story stays scattered across repos, launches and posts that nobody reads closely. FairShot is a VC operating system built to fix that: it finds overlooked founders, assesses them the way a talent team would, and gets them an evidence-backed hundred-thousand-dollar decision inside 24 hours."

## Scene 2: The thesis (15s)

SCREEN: Thesis page. Point at sectors, check size, conviction threshold.

NARRATION: "Everything starts with the investor's thesis. Sectors, stage, geography, check size, risk appetite. Nothing is hardcoded: change this and every score in the system changes with it."

## Scene 3: Sourcing, live (40s)

SCREEN: Pipeline page. Click Run outbound scan. Wait for the results line. Point at new cards appearing in Sourced and Screened. Then type a GitHub handle into the Source founder box and run it.

NARRATION: "Sourcing is where FairShot goes deepest. Watch it work live: it's scanning GitHub, Hacker News and arXiv right now, real founders, real signals, no dataset. Everything lands in one funnel, deduplicated across channels, and screened against the thesis by the reasoning layer. When someone crosses the conviction threshold, they're invited to interview automatically. And it does targeted sourcing too: give it any GitHub handle and it builds an evidence profile from that person's real footprint: repos, followers, stars, a ninety-day activity pulse, and anything they publish on Medium or Substack, with an identity gate that throws away results about people with similar names. When it profiled me, it found my real repos and correctly excluded two other Pauls."

## Scene 4: The cold start, Amara (75s)

SCREEN: Apply page. Click Load demo application, point at the empty links field and the "Give us something we can check" panel. Submit. Point at the pre-interview brief: what we'll dig into, and the claims we couldn't confirm. Click I'm ready. Click the voice toggle, let it read the first question aloud, answer one question with the mic, mentioning NHS England's e-rostering guidance. Wait for the "Checked while you spoke" chip to appear under the reply and point at it. Then cut to the completed interview's feedback card (have a finished run ready in another tab to avoid waiting).

NARRATION: "Here's the case that matters most: the founder the industry can't see. Amara spent eleven years running hospital staffing rotas. She built a tool that three wards use. No GitHub, no investors, no network. On paper she's invisible, and her application scores a twelve, because almost nothing she says can be verified from the outside. So FairShot interviews her. First it briefs her: here's what we'll dig into, here's what you told us that we couldn't confirm, bring proof if you have it. Then the interview, a Socratic behavioural interview, the same craft a talent assessor uses: every question anchored in her actual evidence, probing for what she personally did. And watch what happens while she answers: it's fact-checking her in real time. She mentions NHS England's staffing guidance, and before the next question arrives, it has found the source and said so, on screen, with the link. When it can't find a public record, it says that too, and asks who could confirm it. Diligence isn't a stage that happens after the conversation. It's happening inside it. And notice what it corroborated: the public context. Amara's own work is exactly what can't be publicly checked, which is why the interviewer's follow-up asks who could confirm it. When it ends, her capability is visible: four traits scored with confidence levels, and her Founder Score moves from twelve to fifty-four. Fifty-four with medium confidence, and the memo says precisely which parts are corroborated and which are still her word alone. Honest, not generous. And she gets this: what we saw, where evidence was thin, and exactly what would strengthen her next application. Every founder gets that back, funded or not."

## Scene 5: The investor side (45s)

SCREEN: Memo page for Priya Nair (run diligence beforehand so the memo exists). Scroll slowly: three axes, capability panel, click one evidence link, the gaps box, then the decision buttons. The memo's own verdict is WATCH; either click Watch, or click Invest and say the override line below.

NARRATION: "The investor sees three independent lenses, never averaged: Founder, Market, and whether the idea survives scrutiny, each with its own direction of travel. Under it, the capability assessment, and every score links to the exact evidence behind it, click it and you're looking at the claim and its sources. The memo drafts itself from Memory only. What it can't verify, it says so. What's missing, it flags rather than invents: cap table not disclosed, financials not available. And then the decision: one click, and the system records how long it took from first signal to money decision. For Amara, that was under an hour. Notice the memo's own verdict here is watch. I can overrule it, and if I do, the record shows the human disagreed with the evidence. Decision support that keeps the human honest too."

## Scene 6: Ask it anything (15s)

SCREEN: Dashboard query bar. Type: technical founder, Europe, AI infra, no prior VC backing. Show results with the match reasons.

NARRATION: "And the whole memory is queryable in plain English. One compound question, one pass, and every result explains exactly why it matched, including understanding that 'never raised money' is a point in a founder's favour."

## Scene 7: Close (20s)

SCREEN: Dashboard, scroll to the What FairShot deliberately ignores panel.

NARRATION: "FairShot deliberately ignores where you went to school, who referred you, and what brand names sit on your CV. And it has one hard rule we wrote into the code: real people it discovers are prioritised, never judged, until they choose to take part. It even assessed me, its builder, and told me: watch, not invest. Show me traction. That's the point. A system honest enough to say that is a system a founder can trust with their shot. FairShot: built solo in 24 hours, so that funding decisions take 24 hours too."

## Cut list if over time

Scene 2 can merge into Scene 3 (one line while the pipeline loads). Scene 6 can drop to a single beat inside Scene 7. Never cut Amara or the memo walkthrough.
