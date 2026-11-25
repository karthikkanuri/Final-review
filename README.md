# Quiz Builder — React + Vite

## Features
- Admin and student accounts (demo authentication with Local Storage)
- Admin dashboard with quiz create, edit, delete and quiz codes
- Multiple-choice, True/False and open-ended questions
- Question randomization when a quiz starts
- Automatic score calculation and attempt history
- Admin performance report and student recent attempts
- Responsive layout

## Run in VS Code
1. Extract this ZIP.
2. Open the extracted `quiz-builder-react` folder in VS Code.
3. Open Terminal > New Terminal.
4. Run:

```bash
npm install
npm run dev
```

5. Open the local URL printed in the terminal (usually http://localhost:5173).

## Demo usage
1. Sign up as an Admin / Teacher.
2. Create a quiz and add questions.
3. Note the six-digit join code shown on the Admin dashboard.
4. Sign up as a User / Student in another browser profile, or log out and create a user account.
5. Open the quiz and submit answers.
6. Return to Admin > Quiz reports to see attempts and scores.

## Deploy to Vercel
1. Push the extracted project folder to a new GitHub repository (or replace the old repository after keeping a backup).
2. In Vercel, import the repository.
3. Framework preset: Vite; Build command: `npm run build`; Output directory: `dist`.
4. Deploy.

## Important limitations for project review
This version uses browser Local Storage as required by the current assignment criteria. Local Storage is limited to one browser/device and is not a shared database. Therefore, quiz codes and participation are a local demo flow, not true multi-device real-time synchronization. True real-time participation across devices needs a backend/database and real-time service (for example Firebase or Supabase). Also, open-ended answers are auto-checked by exact case-insensitive text matching; this is suitable for a simple demo, not semantic grading. For production, never store plain-text passwords or rely on client-side role selection for admin security.

## Admin-controlled quiz timer
- Admins set a duration in minutes when creating or editing a quiz (1–600 minutes).
- Students see a live MM:SS countdown while attempting the quiz.
- When the countdown reaches zero, the quiz is automatically submitted and scored.
- Existing quizzes without a saved duration use a default of 10 minutes.

## Latest additions
- Forgot-password flow with a simple arithmetic CAPTCHA and password change.
- Admins can optionally set a quiz opening date/time and closing date/time.
- Admins can set the maximum number of attempts allowed per student.
- Quiz access is blocked before the opening time, after the closing time, and after the student's attempt limit is reached.

Note: This project is still a frontend Local Storage demo. The CAPTCHA and password reset are demonstration features, not production-grade account security. A real deployment needs a backend, secure password hashing, and email/OTP verification. Attempt limits and quiz access windows are also enforced in this browser-only demo and can be bypassed by a technically capable user; use a backend for reliable enforcement across devices.

## Quiz password protection
Admins can optionally set a password while creating or editing a quiz. Students must enter that password before starting the quiz, whether they open it from the quiz card or join with the quiz code. Leave the password field blank to keep the quiz open without a password.

This is a front-end Local Storage demo. The quiz password is stored in the browser and can be inspected or bypassed by a technically skilled user. For real exam security, store password verification and quiz access checks on a backend server.

## Admin-wise quiz and leaderboard privacy
- Each quiz is saved with the email address of the admin who created it.
- An admin dashboard lists only quizzes created by the currently logged-in admin.
- Admins can edit or delete only their own quizzes; ownership is preserved when editing.
- Dashboard statistics, recent attempts, and full reports include only attempts for that admin's own quizzes.
- The leaderboard is calculated only from attempts on quizzes created by the currently logged-in admin. It does not include another admin's quizzes, scores, or best-scoring quiz.
- Students can still see and attempt quizzes from all admins, subject to each quiz's password, access window, and attempt limit.

Security note: these ownership checks are enforced in the React app for this Local Storage demo. They are not secure against browser-data editing or client-side code tampering. Production multi-admin isolation must be enforced by backend authentication and database access rules.
