# Antigravity Rules - Talii Monorepo Project Standards

These rules define the standard coding practices, architecture, token-saving protocols, and development processes for the Talii monorepo. They must be followed strictly by the AI agent to drive fast, robust, token-efficient, and maintainable software development.

---

## 1. Token Optimization & Agent Efficiency

### Rule 1: Ultra-Concise Chat Responses & Fluff Elimination
Keep chat outputs direct, raw, and highly token-efficient to conserve LLM processing space. Do not write conversational pleasantries such as greetings, acknowledgments, or redundant summaries of the steps. The agent must proceed immediately to code editing, diff generation, or command execution without unnecessary text introduction. Every response should prioritize actionable files, command strings, and exact terminal commands over conversational dialogue. Minimizing conversational overhead optimizes context length and speeds up the model's response cycles.

### Rule 2: Unified Diffs & Minimal Code Outputs
Avoid outputting full source files in chat responses as it consumes large amounts of context window tokens. Instead, present code modifications using standard git-style unified diffs showing only the modified lines prefixed with additions or deletions. Always specify the target file's absolute path clearly above the diff blocks to maintain directory context. This strategy ensures the code changes are immediately readable and cheap to process in subsequent turns. Code formatting tools and linter setups can then be easily applied to the changed snippets.

### Rule 3: Targeted Sub-Line AST Mutations
When modifying files, target the smallest possible range of code to maintain structural integrity. Use precise range search matches in the file content editors rather than replacing vast sections or entire helper classes. Ensure that match templates contain unique context lines to avoid ambiguous matches during editing operations. Check that parenthetical scopes and AST syntax are closed correctly to prevent compilation errors. Running local syntax parsers on modified files beforehand guarantees syntax validity.

---

## 2. Project Architecture & Workspace Boundaries

### Rule 4: Strict Monorepo Workspace Segregation
Keep code isolated within their target package structures to prevent boundary pollution. Code inside `apps/web` or `apps/mobile` must not share direct dependencies unless they are formally extracted into `packages/shared`. Execute npm scripts and test commands with workspace scopes like `-w packages/shared` to enforce separate node_modules caching. Do not add general dependencies to the root workspace files unless they apply to all packages. Maintaining this architectural border is essential for bundling operations and micro-frontend deployments.

### Rule 5: Centralized Configuration Contracts
Avoid embedding static configuration values, ports, or integration flags directly inside components. Instead, consolidate all client configuration settings and environment variable bindings in a centralized directory. Mark configuration objects as read-only constants using TypeScript's `as const` directive to prevent runtime modifications. This configuration approach keeps the application configurable across dev, staging, and production environments. Decoupling config files from actual application modules simplifies automated environment provisioning.

### Rule 6: Zero Emojis and Special Dingbats
To prevent character serialization errors and save token usage, emojis are banned across the workspace. Do not write emojis or unicode shapes inside source files, docstrings, commit logs, or markdown files. Use clean, plain-text indicators to list states or check-off task lists. This maintains a clean repository and prevents parsing issues across terminals and CI pipelines. Keeping character sets restricted to standard UTF-8 ASCII protects data parsing in CLI configurations.

### Rule 7: Decoupled Documentation Layer
Keep documentation folders completely separate from the executable modules of the project. Runtime code files must not import, read, or resolve files that are stored inside the `/docs` directory. This separation ensures that refactoring the documentation does not cause runtime side effects or dependency invalidation during compilation. Ensure that all guides are updated alongside code changes to prevent stale information. Clean Separation of Concerns between documentation and software logic improves development velocity.

---

## 3. UI, Styling & Visual Accessibility

### Rule 8: Theme Contrast Compliance
The primary brand color variables (--primary, --secondary, --saffron) are mapped to saffron orange. Placing dark text or low-contrast colors on these backgrounds violates accessibility rules. When modifying or creating UI components, ensure that white or high-contrast text styles are always overlayed on saffron elements. This compliance creates a readable interface across screen types. Running automatic contrast-ratio checker checks during UI implementation avoids manual review overhead.

### Rule 9: Composited CSS Transitions
Avoid using complex Javascript loops or libraries to handle interface transitions. Implement visual animations using native CSS keyframes or transitions to keep the browser thread responsive. Only animate hardware-accelerated CSS properties like opacity and transform to avoid layout thrashing. Set transitions to durations under 300ms to keep interface navigation fast. Hardware acceleration prevents frame-drops and input lags on mobile devices.

---

## 4. Code Quality & Typing Standards

### Rule 10: Strict TypeScript Typing
Avoid typing shortcuts like `any` that bypass typescript safety checks. If a type is unknown at runtime, use the `unknown` type coupled with strict type guards to cast values safely. Define explicit return types for React components, server functions, and database query methods to enforce interface contracts. This strictness catches type mismatches before runtime execution. Leveraging compilation checks for boundary data ensures complete data safety throughout the stack.

### Rule 11: Production-Ready Implementations
Avoid leaving stubs, comments like `// TODO: finish implementation`, or placeholder return variables in code. Every file modification must contain a complete, functional, and production-ready implementation. If a feature depends on future variables, handle empty state cases gracefully inside the logic. This rule prevents regressions and ensures the main branch compiles at all times. Shipping fully realized units of code allows continuous integration loops to proceed uninterrupted.

### Rule 12: Pure Functions & Immutability
Write data processing utilities as pure functions that do not mutate their input parameters. This is critical for scheduling slots, calculation functions, and pricing utilities. Return new array or object instances rather than directly modifying the state of passed variables. This functional style prevents side effects and simplifies unit testing. Isolated stateless methods can be safely executed concurrently without race conditions.

---

## 5. Supabase Database & Security

### Rule 13: Mandatory Row-Level Security (RLS)
Enforce Row-Level Security on every table created in Supabase. Define explicit security policies for select, insert, update, and delete actions. Verify that actions are restricted to authenticated owners or authorized roles. This security measure prevents malicious users from bypassing client-side forms. Auditing policy structures using automated SQL unit tests prevents accidental data leaks.

### Rule 14: Automated Schema Type Syncing
Ensure TypeScript database mappings are kept in sync with the database state. Regenerate database types whenever a migration, constraint, or table structure changes. Reference these generated typings in database models to avoid runtime casting errors. This maintains full synchronization between the backend schemas and the frontend models. Tracking schema type structures in git history provides visibility into model drifts over time.

### Rule 15: Constraint-Driven Data Integrity
Do not rely solely on client-side or api-level validations to enforce schema integrity. Use database check constraints, unique constraints, and foreign keys to prevent corrupt records. Direct validation at the database layer acts as a safety boundary for concurrent client actions. This prevents data fragmentation or duplicate bookings in high-load situations. Database-level schemas serve as the final gatekeeper for data transactions.

---

## 6. Payment Processing & Stripe Integration

### Rule 16: Asynchronous Webhook Execution
Respond to Stripe webhook events immediately with an HTTP 200 status code before performing complex tasks. Parse and validate the webhook event signature, and store the raw payload in the database. Process the actual business logic asynchronously in the background. This ensures Stripe does not assume a timeout occurred and trigger redundant retries. Running decoupling strategies via message queues ensures reliable webhook handling under traffic spikes.

### Rule 17: On-Demand Onboarding Verification
Do not rely on successful redirects to mark a barber's onboarding flow as complete. Always perform a direct server-to-server validation check of the Stripe account state during checkout initialization. This ensures that the barber's payment credentials are valid before creating payment intents. This prevents failed sessions and errors at checkout. Direct API status checks act as a safety barrier against client status spoofing.

### Rule 18: Multi-Tenant Separation in Queries
Ensure every database request restricts data fetching to the verified tenant identifier. Never trust client-supplied parameters for scoping without server-side validation. Use the session auth token metadata to retrieve the tenant context ID. This separation ensures user account segregation across the platform. Restricting database views based on session contexts forms a core element of tenant isolation security.

---

## 7. Testing & Verification Processes

### Rule 19: Continuous Test Validation
Proactively run test commands inside packages when making modifications. Do not ask for user permission before executing tests. Report pass/fail results clearly in your response. This continuous verification catches regressions before they are pushed to the main codebase. Verifying compilation states locally guarantees branch integrity during downstream deployments.

### Rule 20: Documentation Link Integrity
Maintain complete reference paths across all markdown files in the project. Use the local link checker script to verify that relative paths resolve correctly after document movements. Fix any broken links immediately to ensure documentation indexes stay valid. This keeps the unified documentation search accurate and functional. Accurate reference files prevent developer onboarding fatigue and link errors.

---

## 8. Deployment & Environmental Safeguards

### Rule 21: Git Commit & Pull Request Standard
Keep Git logs descriptive, structured, and free of emoji characters. Write commits in the imperative mood and reference relevant issue trackers. Ensure that pull request descriptions outline changes, architectural updates, and verification results. This commit history standard simplifies git blames and debugging processes. Descriptive commit history is vital for team-based auditing and code review contexts.

### Rule 22: Sentry Error Logging & Client boundary Protection
Protect the React render tree by wrapping components in custom error boundaries. Capture unhandled runtime exceptions and forward them to Sentry using correct boundary contexts. Do not swallow errors; report them to the user interface via friendly error components. This observability approach helps developers debug frontend exceptions quickly. Fine-grained monitoring helps trace source maps to the exact lines of code.

### Rule 23: Next.js Server Side Rendering (SSR) & Route Caching
Distinguish between server and client components by placing the appropriate directives at the top of files. Enable page route caching and data prefetching strategically to speed up loading times. Ensure server actions handle authentication contexts securely. This keeps the application load times fast. Fine-tuning cache layers reduces backend server rendering loads and database queries.

### Rule 24: Environment Variables Sanitation
Never expose server-side secrets or integration credentials to client-facing scopes. Prepend client-accessible variables with the correct public prefix. Maintain environment contracts inside documentation to assist setup processes. This sanitation prevents key exposure in browser build bundles. Restricting production variables to private runtime setups minimizes attack vectors.

### Rule 25: Mock Data and Local Database Seeding
Write seeding scripts to populate local database instances with mock records for development. Avoid polluting production schemas with dummy users or fake barber calendars. Maintain seed profiles in the packages folder to allow standard developer setup. This makes local environment setup reproducible and isolated. Isolated datasets enable developers to test edge cases locally without breaking live workflows.

### Rule 26: Active Problem Tracking
Maintain an active problem log in docs/development/CURRENT_PROBLEMS.md that tracks all known compilation errors, linter violations, and typescript casting issues across workspaces. Developers and AI agents must update this document when introducing or discovering codebase issues to keep technical debt visible. Legacy documentation can be compiled from historical entries in this log to document refactoring progress. Every entry must detail the file path, the specific error classification, and the proposed resolution. Reviewing the active problem log before implementing new features prevents building on top of unresolved regressions.
