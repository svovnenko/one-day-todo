# One-Day To-Do

[![CI](https://github.com/svovnenko/one-day-todo/actions/workflows/ci.yml/badge.svg)](https://github.com/svovnenko/one-day-todo/actions/workflows/ci.yml)

A minimal single-day to-do list for iPhone and Android, built with Expo
and Expo Router. Add tasks for today, swipe right to complete (with a
2-second Undo), and in the evening move whatever's left over to
tomorrow. One user, one device, no accounts, no sync.

Full product and technical spec: [docs/TODO_APP_SPEC.md](docs/TODO_APP_SPEC.md).
Past work orders (fix rounds, optimizations, refactors) live in
[docs/tasks/](docs/tasks/).

## Development

```bash
npm install
npx expo start
```

Scan the QR code with the iPhone Camera app to open it in **Expo Go**. Phone and PC must be on the same Wi-Fi network (use `npx expo start --tunnel` if not).

## Tests

```bash
npm test
```

## Quality checks

```bash
npm run check
```

Runs typecheck, lint (`eslint`, 0 errors/0 warnings), and the test suite -- the same three steps CI runs on every push and pull request to `main`. `npm run format` applies Prettier; `npm run lint` runs just ESLint.

## Publishing an update

```bash
eas update --branch main --environment production
```

Expo Go needs the new update opened explicitly (dashboard → the update → Preview QR, or Expo Go → Projects → one-day-todo → Branches → main → the top update) -- older Preview links stay pinned to whatever version they were opened with.
