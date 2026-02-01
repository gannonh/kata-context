# Kata Context

## Local Development

### Vercel Dev Limitation

`vercel dev` does not reliably execute serverless functions locally - this is a known issue with no official fix. Functions return 404 locally but work in production.

**Workaround**: Use a local dev server instead of `vercel dev` for API development:
```bash
npx tsx api/health.ts
```

References:
- https://github.com/vercel/vercel/discussions/8312
- https://community.vercel.com/t/vercel-dev-locally-not-serving-functions/2183
