# BrainBoard

[![CI](https://github.com/anshikasahu11/BrainBoard-/actions/workflows/ci.yml/badge.svg)](https://github.com/anshikasahu11/BrainBoard-/actions/workflows/ci.yml)

A real-time workspace for developers and teams: documents, a task board, a code snippet library, live collaboration, notifications and an AI assistant, in one place.

**Live demo: [https://brainboard-beige.vercel.app](https://brainboard-beige.vercel.app)**

> The backend runs on a free plan that sleeps when idle, so the very first request can take about a minute to wake it up. After that it is fast.

## What it does

- **Workspaces and roles.** Create workspaces, add teammates, and give them an owner, admin or member role.
- **Documents.** A rich-text editor with autosave, conflict detection when two people edit at once, and a full version history: automatic snapshots, named versions, compare and restore.
- **Task board.** A Kanban board with drag and drop (keyboard and touch too), priorities, due dates, assignees and filters.
- **Code snippets.** Save code with syntax highlighting, tags and one-click copy.
- **Real time.** Changes appear instantly for everyone: tasks, documents, snippets and members. See who is online and who is editing which document.
- **Search.** Press `Ctrl + K` to search documents, tasks, snippets and people in the workspace.
- **Activity feed.** A readable history of what happened and who did it.
- **Notifications.** A live bell, settings for what you hear about, and reminders when a task is due soon or overdue, worked out in each person's own time zone.
- **AI assistant.** Summarise a document, explain or improve a snippet, or turn meeting notes into proposed tasks that you review before anything is created. It only ever suggests, and it has daily spending limits.

## Built with

| Layer | Tools |
|---|---|
| Website | Next.js 16 (App Router), React 19, Tailwind CSS 4, Tiptap, dnd-kit |
| Server | Node.js, Express 5, Socket.IO, Zod |
| Database | MongoDB Atlas with Mongoose |
| Hosting | Vercel (website), Render (server), Atlas (database) |

## Security

Security was treated as a feature, and measured rather than assumed.

- Every query is scoped to a workspace the person belongs to. A stranger gets "not found" for everything in someone else's workspace.
- Passwords are hashed. Login tokens are validated strictly, and signing out **really ends the session**, including its live connections.
- Login timing doesn't reveal which emails have accounts.
- Rate limits count each visitor separately behind the host's proxies, measured on the live server.
- The website sends a Content-Security-Policy and the usual protective headers. CORS allows only the exact website address.
- Production refuses to start with weak or unsafe settings.
- An outside-in audit script (`backend/scripts/security-audit.mjs`) attacks the running app and reports findings.
- Colour contrast is computed from the real stylesheet and meets WCAG AA.

## Testing

One command runs every check, from any folder:

```bash
node tools/check-all.mjs
```

It runs lint, hundreds of unit checks, and live checks of the API and real-time layer against a separate test database. The same command runs on GitHub on every push, against a real MongoDB.

Use `node tools/check-all.mjs --quick` for the fast checks that need no servers.

## Run it on your own computer

You need Node.js 24 and a free MongoDB Atlas cluster.

```bash
# the server
cd backend
cp .env.example .env     # then fill in MONGODB_URI and JWT_SECRET
npm ci
npm run dev

# the website (in a second terminal)
cd frontend
npm ci
echo NEXT_PUBLIC_API_URL=http://localhost:5000 > .env.local
npm run dev
```

Open http://localhost:3000.

## Deployment

The server is described in `render.yaml` and deployed on Render. The website is deployed on Vercel with `frontend` as its root directory. Secrets are set in each host's dashboard and never stored in the repository.