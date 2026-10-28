# @pawnpilot/api-client

Generated TypeScript types for the PawnPilot REST API.

The package exports the generated OpenAPI `paths`, `components`, and `operations` types, plus a
few named request-body aliases used by the web app and integration tests.

## Generate

Start the API in a non-production environment, then run from the repository root:

```bash
npm run openapi:generate
```

This writes `src/schema.d.ts` from `http://localhost:3001/api/openapi.json`.

The API enables Swagger only outside production. Request bodies are documented with
`@nestjs/swagger` decorators on the DTOs; response body schemas are intentionally thin in Phase 2
and should be expanded as endpoints stabilize.
