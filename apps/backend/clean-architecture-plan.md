# Clean Architecture Plan (Backend)

- [ ] Define use cases for auth (register/login/reset/verify) and route handlers as controllers.
- [ ] Introduce ports for external services (email, LLM, code execution, eventing) and move direct calls out of routes.
- [ ] Add domain entities/value objects for writing challenges, submissions, and learning analysis as needed.
- [ ] Map Prisma models to domain entities in repositories; remove direct ORM usage from routes.
- [ ] Move access control and invariants into use cases (e.g., assigned-to checks, status transitions).
