<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Project rules

- Signed-in pages live under `src/routes/_authenticated/` (client-only gate redirecting to `/auth`); why: the login session lives in browser storage, which the server can't read.
- Move setup writes `moves` straight from the browser client, relying on row-level security; why: simple owner-scoped insert, no server logic needed yet.
- `corridor_knowledge` and `modifier_knowledge` are read-only to signed-in users and seeded with user-provided SQL only; why: content is curated and fact-checked by the owner.
