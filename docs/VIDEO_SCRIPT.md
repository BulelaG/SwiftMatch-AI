# SwiftMatch AI — 3-Minute Video Script (due Sat 24 Oct, 07:00)

Follows the YES guide exactly: 0:00–0:30 problem · 0:30–1:45 demo · 1:45–2:30 value & AI · 2:30–3:00 responsible AI & next steps.
Target: ~400 spoken words at a calm pace. Record the screen, talk over it. No slides needed except the single title card.

## Before you press record (10 min)

1. Backend running: `cd C:\projects\SwiftMatch-AI\server && node server.js` → wait for "Indexed 6 SME capability vectors".
2. Frontend running: `cd C:\projects\SwiftMatch-AI\client && npm start -- --port 4300` → open http://localhost:4300.
3. If you want live Claude text: put `ANTHROPIC_API_KEY=sk-ant-...` in `server/.env` and restart the backend. Without it, every button still works with deterministic text.
4. Browser: Chrome, 1920×1080 or 1600×900, zoom 110%, bookmarks bar hidden (Ctrl+Shift+B), dark theme on, close other tabs.
5. Do ONE full dry run clicking through the path below. Then record.
6. Recorder: Windows key + Alt + R (Xbox Game Bar) records the active window, or OBS. Microphone close to your mouth, quiet corner.
7. Trim to under 3:00. Export MP4 (H.264). Name it `SwiftHouse_SwiftMatchAI.mp4`. Upload BEFORE 06:00. Confirm the upload finished.

## Click path (what's on screen)

| Time | On screen | Action |
|---|---|---|
| 0:00 | Title card or Screen 1 header | Just talk |
| 0:30 | Screen 1 | Click preset **"Innovation Lab Fitout"** (timber tables) |
| 0:40 | Screen 1 | Clear the text box, paste the held-out RFQ below, click **Claude AI** (fields fill), tick **Youth-owned** |
| 0:55 | Screen 1 | Click **Search & Evaluate Matches** |
| 1:00 | Screen 2 | Point at engine chip, featured card, the **"How the % was computed"** table |
| 1:20 | Screen 2 | Scroll to the ranked table: show the **Ineligible** row (Ekurhuleni Metal, Tax PIN missing) |
| 1:30 | Screen 2 | Click **Generate Claude audit trail** (or the template), click **B-BBEE Calculate** |
| 1:45 | Screen 2 | Click **Open Maker Mobile View** |
| 1:50 | Screen 3 (phone) | Click **Preview WhatsApp dispatch**, then **Accept Opportunity** |
| 2:15 | Screen 3 | Scroll to **Supplier Readiness Gap Advisor** |
| 2:30 | Screen 2 | Click **Open model card** in the Responsible AI panel |
| 2:50 | Terminal (optional) | Show `npm run eval` output: hybrid 100% vs lexical 58% |

Held-out RFQ to paste at 0:40 (no shared keywords with any SME tags, so it proves semantic matching):

> Looking for a carpenter to build 6 hardwood reception counters and 12 matching bookshelves for our Pretoria offices. Budget R90,000, 5 weeks.

## Narration

**[0:00–0:30] The problem — Challenge 4, SME to Corporate Opportunity Matching**

"I'm Bulela from Swift House, and this is SwiftMatch AI for Challenge 4.
Corporate South Africa spends tens of billions of rand a year on supplier development, yet a procurement officer in Sandton still can't find a verified carpenter in Soweto. Their tools are keyword vendor databases that only match exact words. The makers aren't on those databases at all. They run their businesses on WhatsApp. So the money defaults to the same incumbents, and youth-owned township businesses never see the opportunity."

**[0:30–1:45] What we built — show it working**

"Here's the corporate side. I paste a real requirement in plain English: a carpenter for hardwood reception counters in Pretoria. Claude extracts the quantity, budget, deadline and site. I tick that the supplier must be youth-owned.

Search. In under a second the engine scores every supplier. Notice the chip: this is a sentence-embedding model running on-device, 384-dimensional vectors, so 'hardwood reception counters' matches a workshop that describes itself as 'solid oak joinery', with no shared words.

Every score is explained. This table is the actual formula: 35% semantic fit with the cosine value, 25% capacity, 15% mandatory compliance, 15% distance, 10% track record. No demographic inputs.

Scroll down: one supplier is marked ineligible, not hidden. Their SARS tax PIN is missing, and the system says exactly that. That's the right of response the brief asks for.

For the procurement officer: a Claude-written audit paragraph, and the B-BBEE recognised spend this order earns them.

Now the other side of the match. This is what the maker sees on their phone. Plain-language WhatsApp message, in their words, not procurement language. They accept, and only then does the buyer get their phone number."

**[1:45–2:30] Value, how AI is used, why it's better**

"Two beneficiaries. Corporates get a defensible shortlist in seconds instead of weeks, with an audit trail they can show a B-BBEE verifier. Youth-owned SMEs get found for what they can actually make, and get told what document to fix to win bigger contracts: this gap advisor is the funding-and-readiness piece of the brief.

AI sits in three places: on-device embeddings for matching, deterministic weighted scoring for ranking, and Claude only for language: extracting RFQ fields, writing the audit narrative, and drafting the WhatsApp message. The model never awards anything; people do.

Why better than a vendor database: on our held-out test set the semantic engine ranks the right supplier first 100% of the time; keyword matching manages 58%."

**[2:30–3:00] Responsible AI and next steps**

"Data: six synthetic supplier profiles modelled on real Kasi-eCo marketplace categories, our live township marketplace. No real personal data. Phone numbers are masked until consent. Age, gender and names are never scoring inputs, and the model card on screen lists every limitation, including that a tiny synthetic dataset doesn't validate real award outcomes.

Next: pilot with one YES corporate partner and fifty verified Kasi-eCo makers, wire in CIPC and SARS verification, and add the funding-eligibility matcher. Swift House is CIPC-registered and ready to build this in the hub. Thank you."

## If you're running long

Cut in this order: the B-BBEE calculate click, the terminal eval shot, the gap advisor scroll. Never cut the ineligible row or the WhatsApp accept; those are the two moments that map to the brief's deliverables.
