# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability in EcoTrack, please report it responsibly by emailing us at **security@ecotrack.app**. We take all security issues seriously and will respond within 48 hours.

## Security Measures

### Authentication & Authorization
- **Google OAuth 2.0**: All user authentication is handled via Google's secure OAuth 2.0 flow. We never store user passwords.
- **JWT Tokens**: Session management uses signed JSON Web Tokens (HS256) with configurable expiry (default: 30 days). Tokens are verified on every authenticated request.
- **Fallback User**: For local development, unauthenticated requests fall back to a default user (ID 1) to simplify testing.

### HTTP Security Headers
- **Helmet.js**: All responses include security headers via the `helmet` middleware:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Strict-Transport-Security` (HSTS)
  - `Content-Security-Policy`

### Rate Limiting
- **express-rate-limit**: All API endpoints are rate-limited to **200 requests per 15-minute window** per IP address, protecting against brute-force attacks and DDoS.

### Data Protection
- **Parameterized Queries**: All database queries use Knex.js query builder, which automatically parameterizes all SQL inputs to prevent SQL injection.
- **Input Validation**: All API endpoints validate required fields and reject malformed requests with appropriate HTTP 400 responses.
- **No Raw SQL**: The application does not use raw string concatenation for SQL queries.

### Environment Variables
- **Secrets Management**: All sensitive credentials (API keys, JWT secret, OAuth client IDs) are stored in environment variables, never committed to version control.
- **`.gitignore`**: The `.env` file is excluded from Git to prevent accidental credential exposure.
- **`.env.example`**: A template file is provided with placeholder values for safe onboarding.

### Infrastructure
- **CORS**: Cross-Origin Resource Sharing is configured to allow only whitelisted frontend origins.
- **Redis**: Optional caching layer with automatic fallback when unavailable. No sensitive data is cached.
- **SQLite WAL Mode**: Database uses Write-Ahead Logging for crash resilience and data integrity.

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 1.0.x   | ✅        |

## Dependencies

We regularly audit dependencies using `npm audit` and update packages to patch known vulnerabilities.
