# @pawnpilot/api-client

Generated TypeScript types for the PawnPilot REST API.

Phase 1 establishes the package and generation command. The generated schema will be added when
Phase 2 introduces the first authenticated endpoints.

## Generate

Start the API locally, then run:

```bash
npm run openapi:generate
```

This writes `src/schema.d.ts` from `http://localhost:3001/api/openapi.json`.
