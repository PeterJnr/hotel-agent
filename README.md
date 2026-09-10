# Apex Solacii

An AI-first hotel management and guest experience platform. Apex Solacii combines room discovery, reservations, Paystack payments, service requests, transactional email, staff operations, and Solacii AI, a Gemini-powered concierge with explicit confirmation for protected actions.

## Stack

- Node.js and Express API
- PostgreSQL with Prisma ORM
- React, Vite, React Router, and TanStack Query
- Google Gemini for the AI concierge
- Paystack for NGN payments and refunds
- Sendlib for transactional email
- Cloudinary for room imagery

## Local setup

1. Install backend dependencies with `npm install`.
2. Install frontend dependencies with `npm install --prefix frontend`.
3. Copy `.env.example` to `.env` and configure the required values.
4. Apply migrations with `npx prisma migrate deploy --config prisma7.config.ts`.
5. Generate Prisma Client with `npx prisma generate --config prisma7.config.ts`.
6. Start the API with `npm run dev`.
7. Start the frontend with `npm run dev --prefix frontend`.

The API runs on `http://localhost:6000` by default. The Vite frontend normally runs on `http://localhost:5173`.

## Verification

Backend smoke-test commands are defined in the root `package.json`. Frontend quality checks are available through:

```bash
npm run lint --prefix frontend
npm run build --prefix frontend
```

The `postman` directory contains an importable local environment and complete API collection.

## Security notes

- Never commit `.env` or production credentials.
- AI actions that mutate hotel data require explicit customer confirmation.
- Payment webhooks are signature-verified.
- Staff access is role-based and sensitive account/payment fields are excluded from management responses.
