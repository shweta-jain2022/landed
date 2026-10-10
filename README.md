# Landed

**A personal relocation guide that adapts to your move as it evolves, built on verified information, not guesswork.**

---

## The problem

Moving abroad for work or study means piecing together advice from blogs, forums and group chats. The advice is scattered, often out of date, and rarely specific to your route. It also doesn't tell you how reliable it is.

## What Landed does

You enter where you're moving from, where you're moving to, whether it's for **work** or **study**, and your target date. Landed generates a personalized checklist sequenced by time:

* **Before you leave**
* **After arrival:** First week, First month, First 90 days

Urgent items are flagged inside each group. As your plans change, you tell Landed in plain language ("my spouse is joining in a few months", "I'm bringing my dog") and the checklist updates, with every new or changed item tagged **"Added because..."** so you can trace it back to what you said.

## The trust model (the core idea)

Every item and every chat reply says whether it is **Verified** or **General knowledge**.

|Label|Meaning|
|-|-|
|✅ **Verified**|Backed by curated, fact-checked guidance for this specific route or topic|
|⚠️ **General knowledge**|Sensible general guidance that has not been verified for this route. Confirm with official sources.|

How it's enforced:

* **Labels are decided in code, not by the AI.** For checklist items, an item is Verified only if it cites a section that actually exists in the curated guidance. For chat, only an `exact` topic match is Verified.
* **Chat requests are classified as `exact`, `partial` or `none`.** A question about a parrot will not borrow the verified answer about dogs. It is labeled General knowledge, with a "Closest verified topic" line explaining the gap.
* **Labels are permanent per item.** A later message never upgrades or overwrites an earlier item's label.
* **Summary and filter.** The checklist shows a summary such as "23 items: 13 verified, 10 general knowledge" and can be filtered by All / Verified / General knowledge.

## How AI is used

AI is essential here because the product has to understand free-form language and personalize a plan to an exact move. A static checklist or a form with dropdowns can't do either. But the AI is deliberately kept on a short leash: it writes and interprets, and code decides what counts as verified.

|Step|What the AI does|What code does|
|-|-|-|
|**Country normalization**|Turns messy input ("UAE", "U.A.E.", typos) into a standard country name|Snaps the result to the exact spellings used in the curated tables so lookups match|
|**Checklist generation**|Writes a personalized checklist for the route and target date, sequenced into the four timing groups. Each item names the section of the curated guidance that supports it, or none.|Looks up the one matching curated guidance for the route. Marks an item Verified only if its cited section really exists in that guidance.|
|**Chat classification**|Reads what the user typed ("my wife is coming later", "taking my pet parrot along") and judges how closely it matches a curated topic: `exact`, `partial` or `none`, with a one-sentence reason|Sets the Verified or General knowledge label from the match level. Only `exact` is Verified.|
|**Chat modification**|Explains the impact of the change and returns only the items that are added or changed, each with an "Added because..." reason|Merges the changes into the saved checklist, keeps each item's own label, and saves the conversation|

**Why this design**

* **Personalization from plain language.** Users describe their situation the way they'd tell a friend, and the plan updates.
* **Explains itself.** Every change says why it was added, and every reply says how much to trust it.
* **Honest about its limits.** When a request goes beyond curated knowledge, the AI is told to say so, and the app labels the answer as General knowledge.
* **AI never grades its own homework.** Verified status is set in code from the match level or the cited source, not by the model's own claim.

Landed uses Lovable's built-in AI models, with lighter models for short mechanical tasks like country normalization and stronger ones for checklist generation and chat.

## Features

* Work and Study move types, with manual entry
* Country name normalization (handles "UAE", "United Arab Emirates", typos and similar)
* Checklist grouped by timing, with urgency badges and a progress bar
* Conversational modification chat, with quick-select chips for curated topics and free-text input
* Per-item Verified / General knowledge badges with a clickable **"Added because..."** link back to the chat message
* Persistent chat history per move
* Honest fallback: routes without curated data still get a useful checklist, labeled General knowledge

## Curated data

Landed uses a small hand-curated knowledge base rather than full retrieval (no embeddings or vector search). Lookups are exact-match, and the matching content is passed to the AI as context.

**Curated corridors (origin → destination, move type):**

|Route|Move type|
|-|-|
|Philippines → UAE|Work|
|Nigeria → Canada|Work|
|India → Germany|Study|
|Brazil → Portugal|Study|
|India → United States|Work (H-1B)|
|India → United States|Study (F-1)|

## Scope decisions

* **Work and Study only.** Other situations (family, retirement and so on) can be handled only as chat modifiers on top of a Work or Study move.
* **Asylum and refugee moves are deliberately excluded.** This tool is not appropriate for them.
* **No document upload or extraction.** Manual entry only.
* **Multilingual support** is a possible future addition.

## Tech stack

* Built with [Lovable](https://lovable.dev), using its built-in AI models
* Database tables: `moves`, `corridor_knowledge`, `modifier_knowledge`, `checklist_items`, `move_events`, `chat_messages`
* Row-level security, so each user sees only their own moves, checklists and chats
* Server functions for country normalization, checklist generation and chat modification

## Data model (summary)

|Table|Purpose|
|-|-|
|`moves`|A user's move: origin, destination, move type, target date, visa type|
|`corridor_knowledge`|Curated guidance per origin + destination + move type, with `last_verified` and `source_links`|
|`modifier_knowledge`|Curated answers for chat topics, keyed by destination and topic|
|`checklist_items`|Items per move, with timing group, urgency, `grounded`, `source_section` and `added_because`|
|`chat_messages`|Saved conversation per move, with match level, label and the items each reply added|
|`move_events`|Event log, including match level and reason for debugging|

## Known limitations

* Curated coverage is limited to six routes and two destinations for chat topics. Everything else is General knowledge by design.
* Immigration rules change quickly. The H-1B and F-1 routes in particular are subject to ongoing legal and policy changes. Check `last_verified` dates and official sources.
* LLM output varies between runs, so wording and item order can differ from one generation to the next. The labeling logic does not.

## Version 2 (roadmap)

Ideas for what comes next, roughly in priority order. None of these are built yet.

**Trust and coverage**

* **More curated routes and topics.** Expand beyond six corridors and two chat-topic destinations, with each row carrying its sources and `last_verified` date.
* **Rule-change monitoring.** Flag routes where rules are shifting (for example the H-1B and F-1 routes) and prompt re-verification when sources change, so verified content doesn't quietly go stale.
* **Source citations per item.** Show exactly which official page supports each verified item, not only a per-route sources list.
* **Community and expert review.** Let people who have made the move, or immigration professionals, suggest corrections to curated guidance before they're verified.

**Product**

* **Item-level follow-up chat.** Tap any checklist item to ask a question about just that step.
* **Multilingual support.** Translate the final checklist into the user's language without re-deriving the facts in another language, so verification carries over.
* **Dependents and shared plans.** Let a spouse or family member share the same move, with items assigned to different people.
* **Reminders.** Deadline nudges by email or push for urgent items.
* **Export and share.** Download the checklist as a PDF or share a read-only link.
* **Document upload.** Pre-fill details from a visa letter or offer letter (cut from version 1 to keep scope tight).
* **More ways to move.** Richer support for family, retirement and other situations. Asylum and refugee moves will stay out of scope.

  

## Disclaimer

Landed is a planning aid, **not legal or immigration advice**. Always confirm requirements with official government sources or a qualified professional.

## Hackathon

Built for AI Builders Challenge.
