# Task CLEANUP-01: trim code comments (no behaviour change)

**Why:** comments are about 37% of the source (46 KB of 124 KB in `app/` + `src/`; about 800 of 3,243 lines). Typical is 10–20%. Many are long fix-round narratives that restate the code. They don't affect app size (minification strips them), but they hurt readability.

**Goal:** comments make up **15–20%** of `app/` + `src/`, keeping only what a future reader (human or AI agent) needs.

## Rules
**Keep** (shorten if long, ideally 1–3 lines):
- **Why** comments on non-obvious decisions and past bugs. For example:
  - callbacks reading `useAppStore.getState()` (the stale-closure Undo bug);
  - tasks are not deleted until the Undo window commits (safe failure if the app is killed);
  - the input-session id guard against a stale `keyboardDidHide`;
  - the carry sheet revealed only when the screen is focused and the app is active (the freeze fix);
  - the `ReanimatedSwipeable` direction quirk;
  - local-date keys never use `toISOString()` (UTC);
  - pending-batch tasks count toward the 10-task limit.
- Spec references (`spec 3.4`) where a rule comes from the spec.
- Short JSDoc on exported functions **only** when the name and types don't already say it.
- Lint-disable comments with their reason.

**Remove:**
- Comments that restate the code (`// set the state`, `// return true if full`).
- Multi-paragraph narratives about how a bug was found. Keep the one-line *why*; git history has the rest.
- Duplicate explanations of the same idea in several files. Keep it in one place and use a short pointer elsewhere if needed.
- Commented-out code.

**Don't change any code.** Only comments. Formatting may change only because of Prettier.

## Process
1. Measure before: use the script below and note the numbers.
2. Go file by file, starting with the largest (`app/index.tsx`, `src/store/useAppStore.ts`, `CarryOverSheet.tsx`, `TaskRow.tsx`, `UndoButton.tsx`).
3. Measure after. Report before and after (KB, %, lines) in your final message.

```bash
node -e "const fs=require('fs'),p=require('path');const w=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{const f=p.join(d,e.name);return e.isDirectory()?w(f):/\.(tsx?|js)$/.test(e.name)?[f]:[]});let t=0,c=0;for(const f of [...w('app'),...w('src')]){const s=fs.readFileSync(f,'utf8');t+=s.length;for(const m of s.match(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g)||[])c+=m.length;}console.log((c/1024).toFixed(1)+' KB of '+(t/1024).toFixed(1)+' KB = '+(100*c/t).toFixed(0)+'%')"
```

## Done when
- `npm run check` passes locally and in CI (no code changed, so the tests must pass unchanged).
- Comments are at 15–20%. Commit (one commit is fine) and push.
- **No `eas update` needed**: the published app is identical.
