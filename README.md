   # BrainBoard

   Real-time collaborative workspace for developers and teams.

   ## Structure

   - `frontend/` Next.js app
   - `backend/` Express API

   ## Local setup

   1. Backend: copy `backend/.env.example` to `backend/.env` and fill in the values.
   2. Frontend: create `frontend/.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:5000`.
   3. Run `npm install` and `npm run dev` in each folder.