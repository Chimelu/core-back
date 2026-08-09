# CoreTrust Bank API

REST API for the CoreTrust Bank frontend. Built with Node.js, Express, TypeScript, PostgreSQL and
TypeORM. This folder is fully standalone — it has its own `package.json` and is meant to be deployed
separately from the Vite frontend.

## Requirements

- Node.js 20+
- PostgreSQL 13+

## Getting started

```bash
cd backend
npm install
cp .env.example .env   # then set DATABASE_URL (or the DB_* fields) and JWT secret
npm run migration:run
npm run dev
```

The API starts on the port from `.env` (`http://localhost:4001/api/v1` by
default here). The frontend reads that URL from its own `VITE_API_URL`.

## Scripts

| Script                      | Description                                    |
| --------------------------- | ---------------------------------------------- |
| `npm run dev`               | Start with hot reload (nodemon + tsx)          |
| `npm run build`             | Compile TypeScript to `dist/`                  |
| `npm start`                 | Run the compiled server                        |
| `npm run typecheck`         | Type-check without emitting                    |
| `npm run migration:run`     | Apply pending migrations                       |
| `npm run migration:revert`  | Roll back the last migration                   |
| `npm run migration:generate src/migrations/Name` | Diff entities against the database |

## Project structure

```
src/
  config/       env validation and the TypeORM data source
  entities/     User, RefreshToken, Account, Card, Transfer, Transaction
  middleware/   validation, JWT authentication, role authorization, error handling
  migrations/   SQL migrations
  modules/
    auth/       register, login, refresh, logout, me
    accounts/   account lifecycle and the ledger primitives
    transfers/  CoreTrust, local and international transfers
    cards/      virtual and physical card issuing and controls
  routes/       API router mounted at /api/v1
  utils/        AppError, asyncHandler, password hashing, tokens, money, crypto, generators
  app.ts        Express app wiring
  server.ts     Bootstraps the database then listens
```

## Money and the ledger

`accounts.balance` is the source of truth for spendable funds, and every movement also writes an
immutable row to `transactions` recording the direction, amount and resulting balance. Balances are
`numeric(18,2)`; arithmetic converts to integer cents first so repeated addition cannot drift.

Transfers run inside a single database transaction and take a `pessimistic_write` lock on each
account involved, so two concurrent transfers cannot both pass the balance check and overdraw an
account.

## Authentication

Access tokens are short-lived JWTs (15 minutes by default) sent as `Authorization: Bearer <token>`.
Refresh tokens are opaque 96-character random strings; only a SHA-256 hash is stored in the
database, and each one is rotated (the old row is revoked) every time it is used.

## Endpoints

All responses follow `{ "success": boolean, "data"? : ..., "error"?: { code, message, details? } }`.

### `POST /api/v1/auth/register`

```json
{
  "firstName": "Kaden",
  "lastName": "Tyson",
  "email": "kaden@example.com",
  "phone": "+1 555 010 4477",
  "password": "SuperSecret1"
}
```

Passwords must be 8–72 characters with at least one lowercase letter, one uppercase letter and one
number. Returns `201` with the created user and a token pair. Returns `409` if the email is taken.

### `POST /api/v1/auth/login`

```json
{ "email": "kaden@example.com", "password": "SuperSecret1" }
```

Returns `200` with the user and a token pair, `401` for bad credentials, and `403` if the account is
suspended or closed.

### `POST /api/v1/auth/refresh`

```json
{ "refreshToken": "<token>" }
```

Revokes the supplied refresh token and returns a fresh pair.

### `POST /api/v1/auth/logout`

```json
{ "refreshToken": "<token>" }
```

Revokes the token so it can no longer be exchanged.

### `GET /api/v1/auth/me`

Requires `Authorization: Bearer <accessToken>`. Returns the current user.

### `PATCH /api/v1/auth/me`

Requires `Authorization: Bearer <accessToken>`. Updates the signed-in user's
profile and returns the updated record. Every field is optional; omitted fields
are left unchanged and empty strings clear the value.

```json
{
  "firstName": "Demo",
  "lastName": "Customer",
  "phone": "+1 (555) 014-2291",
  "address": "128 Market Street",
  "city": "San Francisco",
  "country": "United States"
}
```

Email is not editable here because changing a login identifier needs a
verification flow first.

### `GET /api/v1/health`

Liveness probe for your host.

## Accounts

Every route below requires a bearer token and only ever returns rows owned by the caller.

| Method   | Path                             | Description                                              |
| -------- | -------------------------------- | -------------------------------------------------------- |
| `GET`    | `/accounts`                      | All accounts plus `{ totalBalance, accountCount }`        |
| `POST`   | `/accounts`                      | Open an account (`type`, optional `name`, `currency`, `openingDeposit`) |
| `GET`    | `/accounts/:id`                  | Single account                                            |
| `PATCH`  | `/accounts/:id`                  | Rename the account                                        |
| `GET`    | `/accounts/:id/transactions`     | Paginated ledger (`?page=1&limit=20`)                     |
| `POST`   | `/accounts/:id/deposits`         | Credit an account — **admin role only**                   |

Registering a user automatically opens a primary checking account, so a new customer can transact
straight away. Deposits are admin-only because customer-facing funding would normally arrive through
a payment rail rather than a direct API call.

## Transfers

| Method | Path                                        | Description                                        |
| ------ | ------------------------------------------- | -------------------------------------------------- |
| `GET`  | `/transfers`                                | Filter by `kind`, `status`, `q`, with pagination    |
| `GET`  | `/transfers/summary`                        | Sent / received this month and lifetime count       |
| `GET`  | `/transfers/resolve-account?accountNumber=` | Recipient name for a CoreTrust account number       |
| `GET`  | `/transfers/:id`                            | Single transfer                                     |
| `POST` | `/transfers/coretrust`                      | Instant internal transfer, settles immediately      |
| `POST` | `/transfers/local`                          | To another local bank, settles asynchronously       |
| `POST` | `/transfers/international`                  | Requires a SWIFT/BIC code, charges a fee            |

CoreTrust transfers debit the sender and credit the recipient in one transaction and are marked
`completed`. Local and international transfers debit immediately but stay `pending` until the
receiving bank settles. The international fee is `INTERNATIONAL_TRANSFER_FEE_PERCENT` of the amount
and is posted as its own ledger row.

## Cards

| Method   | Path                  | Description                                                     |
| -------- | --------------------- | ---------------------------------------------------------------- |
| `GET`    | `/cards`              | All cards plus `{ totalCards, activeCards, spentThisMonth }`      |
| `POST`   | `/cards`              | Issue a card against an account                                   |
| `GET`    | `/cards/:id`          | Single card                                                       |
| `GET`    | `/cards/:id/reveal`   | Decrypted number, CVV and expiry                                  |
| `PATCH`  | `/cards/:id`          | Update label, spending limit, online and international controls   |
| `POST`   | `/cards/:id/freeze`   | Freeze the card                                                   |
| `POST`   | `/cards/:id/unfreeze` | Unfreeze the card                                                 |
| `DELETE` | `/cards/:id`          | Cancel the card permanently                                       |

Card numbers are generated with a valid Luhn check digit and encrypted with AES-256-GCM using
`CARD_ENCRYPTION_KEY`. List responses only ever expose the masked number and last four digits; the
full PAN is returned exclusively by `/reveal`, which sends `Cache-Control: no-store`. Monthly card
spend is aggregated from the ledger rather than stored in a counter that could fall out of sync.

## Notes

- `/register` and `/login` are rate limited to 10 requests per 15 minutes per IP; transfer creation
  is limited to 20 per minute.
- Users may hold at most 5 active cards.
- `DB_SYNCHRONIZE` should stay `false`; use migrations so the schema is reproducible.
- Set `CORS_ORIGINS` to your deployed frontend URL (comma separated for multiple origins).
- Generate `CARD_ENCRYPTION_KEY` with `openssl rand -hex 32`. Changing it makes existing card
  numbers undecryptable.
