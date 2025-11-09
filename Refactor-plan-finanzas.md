ACTA-UI Repository Cleanup & Refactor Plan

Now that the ACTA-UI front-end is fully functional with real AWS integration (Cognito for auth, DynamoDB/S3 for
data) and no longer relies on placeholder data, we can focus on streamlining the codebase. This involves
reconsidering the need for any mock data mode and performing a thorough repository cleanup and refactoring.
Below, we first evaluate the role of mocks beyond testing, then present a step-by-step plan to remove dead code,
reorganize the project structure, and improve maintainability.
Mocks vs. Functional UI – Beyond Testing
With the UI now loading real data from AWS, the original rationale for using mock data (to simulate
backend responses during development) is largely diminished. All mock data has been removed from
production components as of the latest update 1
. However, it’s worth examining if there are other uses
for mocks aside from unit tests:
•
Developer Onboarding & Offline Development: Mocks can allow running the app without live
backend dependencies. For example, if a new developer doesn’t have AWS credentials or if the
backend is down, a mock mode ensures the UI still functions (e.g. showing sample projects) so they
can explore the interface. This can prevent blockers during development and demo scenarios. In
fact, during AWS integration, the app was designed to display fallback data when AWS calls failed
2
, demonstrating how mocks keep the UI usable even with no backend.
•
UI/UX Validation & Edge Cases: Using mock data can help designers and testers simulate various
scenarios that might be hard to reproduce with real data. For instance, one could load a mock
dataset with hundreds of projects to test pagination or with special characters to test rendering.
Mocks allow forcing error states or empty states to verify the UI’s behavior (e.g. simulating a network
error or no projects available). This is useful in Storybook or integration testing environments where
controlling the data leads to more comprehensive UI validation.
•
Isolation for Frontend Testing: Beyond unit tests, an integration test or manual QA environment
might use a mock API to isolate frontend behavior. This avoids flakiness due to backend issues and
ensures tests focus on UI logic. It’s essentially a form of dependency injection at the app level – the
front-end thinks it’s talking to the real API, but a mock service provides deterministic responses. This
yields more reliable test runs.
•
Demo and Preview Environments: If you need to demo the application to stakeholders without
exposing real data (for privacy or security), a mock mode is beneficial. It can use sanitized or
generated data to showcase features. Mocks ensure no sensitive information is shown and allow
demonstrating features not yet fully implemented on the backend.
In summary, mocks are primarily a development and testing convenience. In production, with a fully
functional backend, we disable them (as reflected by environment flags like VITE_USE_MOCK_API=false
1
in production config 3
). Given our progress, the UI can now rely on live data – meaning the mock mode
can be mostly retired. We will retain minimal mock hooks only for development needs (if at all), and ensure
they are clearly segregated. The plan below will recommend cleaning up any residual mock code or toggles
that are not necessary for the running product.
Repository Cleanup & Refactoring Strategy
Following the successful modernization of ACTA-UI, we will undertake a structured cleanup to remove
legacy artifacts and improve the project’s organization. The goal is to eliminate dead code (especially
anything related to the old API integration or mock data) and refactor the directory layout for clarity. Here’s
the comprehensive plan:
Step 1: Audit & Identify Unused Code/Files
Begin with a thorough audit of the repository to pinpoint any files, modules, or assets that are no longer
used by the production application. Although the recent updates indicate that legacy and mock-only code
have been removed from usage 4
, some of those files may still exist in the repo. Key actions in this audit:
•
Search for Legacy API Usage: Identify references to the old API Gateway endpoints or services. All
data fetching is now done via the AWS SDK (direct DynamoDB/S3 calls), so any functions that still call
the REST API (e.g. via fetch to the API Gateway URL) are candidates for removal. The AWS
integration report explicitly notes “No API Gateway calls – direct AWS SDK access only” 5
, so the
presence of API calls in code means they’re legacy. We should scan for uses of apiBaseUrl or the
execute-api URL in the code. Similarly, files like src/lib/api.ts (which previously defined
getAllProjects, getProjectsByPM , etc. using fetcher calls to API) need review – they may
be outdated after the AWS SDK migration.
•
Find Deprecated Modules: Check if an older data access module like dataService.ts exists.
Previously, components might have imported from a dataService or similar. The migration
6
scripts flagged any component still importing './dataService' as an issue . If src/lib/
dataService.ts or its imports are present, that file is legacy (superseded by
awsDataService.ts ) and should be removed. Our audit should confirm if it was already deleted;
if not, mark it for deletion.
•
Locate Backup & Temp Files: During migration, backup files were created (e.g. api.ts.backup ).
Those were meant as temporary safeties. The plan was to remove the backup once things were
working 7
. We must ensure any “*.backup” files or old copies (maybe an *.old.ts or similar) are
purged to avoid confusion. These files are not used in the build and only serve as clutter now.
•
Check for Sample/Mock Data Files: There might be a samples/ directory or mock data JSON files
that were used for development. For example, we saw references to a samples/documenets
folder in the repo, possibly containing example documents or data used during development. If
these are not needed for any running feature, we can remove them or move them to a clearly
marked docs/ area if they serve as reference. Similarly, any mock response objects or placeholder
images that aren’t actually used can be removed.
2
•
Identify Dev-Only Components: Some React components might have been created for testing or
development purposes but are not part of the production UI. One example is the
AWSDataDashboard.tsx component, which appears to be a test harness to verify AWS calls. It
even contains hard-coded test email and mock download placeholders 8
. Such components are
not rendered in the actual app (assuming they’re not imported in the main UI), and should be
removed or isolated. Leaving them in src/components could confuse future maintainers. We
should either delete these or move them under a clearly named directory (like src/dev/ or src/
__tests__/ ) if we intend to keep them for diagnostic purposes.
•
.pnpm-store and Cache Artifacts: It looks like a .pnpm-store/ directory was checked into the
repo (likely by accident). This is PNPM’s package cache and should not be in version control. It adds
bloat and is not needed for building the app (each developer/CI will generate their own cache). We
will remove this entire directory from the repository and add it to .gitignore to prevent future
commits.
By the end of this audit, we will have a list of files and directories to prune. For each item, double-check that
nothing in the current build or runtime depends on it (e.g. search the codebase for any import of that file).
Given the prior refactoring, it’s expected these are truly orphaned.
Step 2: Remove Legacy and Dead Code
With the audit list in hand, proceed to delete or refactor the identified items. Key removals include:
•
Old Data Access Files: Eliminate any obsolete data source files. For instance, if src/lib/
dataService.ts exists with the old API calls, remove it (all functionality has moved to
awsDataService ). Also remove the old src/lib/api.ts implementation if it is no longer used.
The current code had created a new api.ts as a wrapper to maintain compatibility, but if all
components have been switched to use awsDataService (direct calls), we can consider removing
the indirection entirely. At minimum, purge any functions in api.ts that call the REST endpoints
that are now deprecated. (We’ll revisit whether to keep api.ts as a simple re-export in the refactor
section below.)
•
AWS Migration Backups: Delete src/lib/api.ts.backup (the backup of the old API file) and
any similar backups. The migration tooling explicitly lists this as a final cleanup step 9
. Keeping old
code backups in the repo is unnecessary once we’re confident in the new system (which we are,
given production readiness). The version control history will retain the old code if ever needed.
•
Development/Test Components: Remove the AWSDataDashboard.tsx component and any
other dev-only UI components or utilities that are not part of the production app. These were useful
during migration (e.g., to compare results between old API and new SDK calls), but now they add
noise. If there's value in keeping such test harnesses, migrate them to a test file or a storybook
scenario. Otherwise, purge them. The presence of comments like “Mock download result since
downloadDocument is not implemented” in that component 8
is a clear sign it’s not meant for
end-users. We want to avoid shipping any code that is not executed or that contains test logic.
3
•
API Gateway & CORS Utilities: Remove scripts and config related to the old API Gateway
integration, since the front end no longer goes through API Gateway for data. For example:
•
•
•
The infra/ folder with api-gw-cors.sh and CORS setup docs can be archived outside the
10
main project or deleted. These were instructions to handle CORS on API Gateway endpoints ,
which is moot now that those endpoints aren’t used.
The scripts/apply-cors.cjs and similar can be removed as well. Essentially, anything solely
tied to enabling API Gateway calls from the frontend is not needed (“direct AWS SDK access only” is
5
our current mode ).
Double-check src/env.variables.ts for variables like apiBaseUrl, apiGatewayId , etc.
Those can potentially be removed or marked deprecated if we truly no longer call the API. (If some
features like document generation still use API Gateway, we might keep minimal config; see refactor
notes below.)
•
Mock Data Flags and Data: Since we have decided mocks are not needed in normal operation, we
should clean up the toggles and sample data:
•
•
In the environment config, useMockData (or previously VITE_USE_MOCK_API ) was used only for
development scenarios 11
. We can remove this flag entirely if we choose to fully deprecate mock
mode. Alternatively, if we keep it for the rare offline case, ensure it defaults to false and is clearly
documented. Any mock data definitions that were used when this flag is true (for example, an array
of dummy projects or a mock API service) should be removed if they exist. From the audit, it appears
most mock data was already stripped out during production prep 1
. We just want to be sure no
large JSON blobs or unused __mocks__ directories are lying around.
Remove any .env.mock files or mock-specific environment files from the repo if they exist (they
would contain things like VITE_USE_MOCK=true ). These are not needed in version control;
developers can set the flag locally if ever required. The build pipeline should not consider a mock
configuration at all now.
•
Orphaned Documentation: If there are documentation files referencing outdated behaviors (for
instance, an old README snippet about using a mock server, or instructions for the legacy build),
update or remove them. Documentation should match the current state post-refactor. We can
consolidate relevant docs in a /docs directory. Any files named like AUTHENTICATION_FIX.md,
CORS_SETUP.md , etc., which served as progress logs, might be moved to docs/archives/ or
removed from the main branch to avoid confusion. The Changelog and final reports will serve as the
source of truth.
As we remove files, perform a final check (e.g., run pnpm build and run tests) to ensure nothing
inadvertently breaks. Given that these are unused pieces, the build should remain unaffected. If any
deletion does cause a build error, it means it was still referenced somewhere – in that case, we’ll adjust by
removing the reference or deciding to keep a needed piece.
4
Step 3: Reorganize the Project Directory Structure
With extraneous files gone, it’s time to refactor the layout of the code for clarity and maintainability. A well-
organized structure helps current and future team members quickly locate relevant code. Here are the
recommended structural changes/guidelines:
•
Group by Feature/Domain: Consider organizing components and modules by feature. For example,
the ACTA-UI has domains like Projects (project list, project details), Documents (ACTA generation,
download), Admin Dashboard, Authentication, etc. We can create subdirectories for these: e.g.
src/components/projects/ containing ProjectCard, ProjectSearch,
DynamoProjectsView and related project listing components. An src/components/admin/ for
admin-specific components, etc. This prevents one huge components directory and makes it
clearer which components belong to which part of the app.
•
Separate UI from Logic: Right now, the src/lib/ directory contains logic like
awsDataService.ts and utilities like projectSearch.ts . We should continue this separation:
all code dealing with data fetching or business logic should reside in a services or lib layer, and UI
components remain in the components layer. For clarity, we might rename src/lib to src/
services or src/api :
•
•
•
Keep awsDataService.ts (or consider renaming it to something like projectService.ts if it
primarily handles project data) in this services layer.
The awsDataService might currently contain functions like getAllProjects,
getProjectsByPM, downloadDocument , etc. – essentially the AWS SDK interactions. Ensure this
file (or set of files) is well-scoped. If it grows too large, we can split it (e.g., a projectService.ts
for DynamoDB project queries, and maybe a storageService.ts for S3 download URL
functions).
The front-end components should use these service functions rather than containing fetch logic
themselves. (From the code, DynamoProjectsView calls getProjectsForCurrentUser from
the service 12
, which is good practice.)
•
Centralize Type Definitions: We see interfaces like Project or ProjectSummary defined in
13
various places (for instance, Project in DynamoProjectsView.tsx and ProjectSummary
14
in src/lib/api.ts ). It’s better to define these in a common src/types/ directory or a
types.ts file, so they can be imported consistently across components and services. As part of
refactoring, extract such interface definitions to src/types/project.d.ts (or similar naming).
This avoids duplication and ensures the front-end and service layer use the same data shape. After
moving them, update imports (the codebase likely already has a @/types path alias).
•
Clarify Env and Config Files: The file src/env.variables.ts centralizes environment variables
15 11
, which is great. We should keep this as the single source for configuration constants. One
improvement is to rename it to something like config.ts or move it under a config folder. Also,
review its content:
•
Remove any variables that are no longer needed (e.g., apiBaseUrl some remain for legacy reasons, clearly comment them as deprecated.
if we drop API Gateway). If
5
•
•
Ensure all needed environment keys (Cognito pool ID, S3 bucket, etc.) are documented and used.
Unused ones should be deleted to avoid confusion.
The flags skipAuth and useMockData are defined here. Decide on their fate: if we want to keep
the ability to skip Cognito auth in development (for faster UI iteration), we can leave is (it only activates when DEV and explicitly set, so it’s harmless to production skipAuth 15
as
). For
useMockData , if we drop the mock mode entirely, remove this to clean up. If we keep it, perhaps
rename VITE_USE_MOCK to a consistent naming (currently docs called it VITE_USE_MOCK_API
3
but code expects VITE_USE_MOCK ). Consistency will prevent confusion.
•
Docs and Scripts Location: Gather documentation markdown files under a dedicated docs/
directory. For example, move files like AUTHENTICATION_FLOW_DOCUMENTATION.md,
AWS_SDK_INTEGRATION_COMPLETE.md, PRODUCTION_READINESS_REPORT.md into docs/ (or
perhaps keep the final report in root for visibility, but generally, docs folder keeps the root clean).
This way, the project root focuses on core config files (package.json, tsconfig, README, etc.), and all
supplementary documentation is in one place. Similarly, ensure the scripts/ directory only
contains active scripts needed for development or build. You might keep some migration scripts for
record, but consider tagging them with a suffix or moving to scripts/archive/ if they are one-
time use. For instance, complete-aws-migration.js and map-api-functions.js were one-
off helpers; we can archive or remove them now that migration is done. Active scripts (like maybe a
deployment script or test runner) stay. Each script file should have a comment indicating its purpose
to avoid future confusion.
After restructuring, update any import paths in the code to reflect moved files (thanks to TypeScript and
path aliases, this is straightforward). For example, if ProjectCard.tsx moves to components/
projects/ProjectCard.tsx , ensure other files import from the new path (perhaps using @/
components/projects/ProjectCard ). Run a TypeScript compile check to catch any broken imports.
Step 4: Simplify and Refine the Data Integration Layer
Now that old code is removed and files are organized, we should refactor the remaining code for simplicity
and clarity, especially around data fetching and API integration:
•
•
•
Finalize AWS SDK Usage: Make sure all components now consistently use the new AWS data service
functions. If any component is still calling functions from the old api.ts or api-amplify.ts,
refactor it to use the direct service. For example, if a component was using
api.getAllProjects() which called the API Gateway, change it to use
awsDataService.getAllProjects() that queries DynamoDB directly. Our goal is to have a
single source of truth for data retrieval. This may involve a few code changes:
Remove any lingering references to fetchAuthSession or Amplify API calls in components that
are better served by our new service. (Amplify Auth will remain for login, but Amplify’s API module is
not needed.)
For instance, the getProjectsByPM function is defined both in the old API layer (using REST) and
in the new AWS service (using DynamoDB). We should eliminate the duplication. Ideally, all project
fetching is done via DynamoDB now. Thus, you could remove the old implementation and adjust any
6
•
•
•
•
•
•
•
•
calls to use the new one. In practice, since we maintained a compatibility layer initially, we might now
confidently cut it out.
Consolidate api.ts vs awsDataService.ts : Initially, to avoid breaking imports, src/lib/
api.ts was possibly turned into a wrapper that re-exported functions from awsDataService
16
. Check the current state:
If api.ts is simply exporting everything from awsDataService (plus maybe a couple of
constants or types for compatibility), we can keep it or simplify it. It might be useful to keep
api.ts as a facade for all data operations (so that in components we only ever import from one
module). In that case, update api.ts to ensure it truly just forwards to AWS SDK implementations
and doesn’t contain any legacy calls. Remove any TODOs or temp implementations in it. Essentially,
finalize it as a clean interface.
If, however, api.ts still contains a lot of legacy code (as the snippet we saw suggests, with
fetcher calls to endpoints 17
), it might be better to strip it down. Possibly, rename
awsDataService.ts to api.ts (since it is now the real API layer) and adjust imports
accordingly, eliminating the need for two separate files.
Also consider the api-amplify.ts module we found. This handles authenticated API calls via
Amplify (with JWT tokens) 18 19
. If we are no longer calling those API Gateway endpoints, most of
the functions in api-amplify.ts become unused. One part to keep is getCurrentUser()
which uses Amplify to get Cognito user info 20
– that’s still relevant for showing the logged-in user’s
details or roles. We should extract or relocate that function (maybe into an authService.ts ). The
rest of the api-amplify (calls like apiGet, apiPost , health checks) can be removed if not
used. This cleanup ensures we don’t maintain code for two different data access methods when only
one is needed.
Review Document Generation Flow: The functions like generateActaDocument and
getPresignedActaUrl in the old api.ts use API Gateway endpoints 21 22
. We need to
decide if these will also be moved to direct AWS SDK (perhaps calling a Lambda or using an AWS SDK
call if available) or if they still go through the existing API. If the backend for these is still an API
Gateway (e.g., a Lambda behind it generating documents), we might temporarily keep those calls.
However, this falls outside the unified direct-to-Dynamo approach. A future enhancement could be to
call AWS Lambda directly via AWS SDK if credentials allow. For now, if we keep these, clearly isolate
them:
Mark in the code that these functions still rely on the REST API (maybe rename the file or functions to
indicate that). Ensure their base URL (API Gateway URL) is still correctly configured in env (it is in
23
env.variables.ts as apiBaseUrl ).
If we foresee migrating them too, note it in TODOs. But do not leave any half-implemented
duplicates. Remove any “temporary” code. For example, if awsDataService doesn’t yet have a
replacement for generateActaDocument , either keep the old one and mark it for later refactor, or
implement it using AWS SDK if possible (could be invoking a Lambda via AWS SDK’s Lambda client).
Clean Up Console Logging and Error Handling: As part of refactoring, remove leftover
console.log or console.warn calls that were added during debugging (especially those that
7
spam the console in production). For instance, DynamoProjectsView logs loaded projects to
console 24
; this can be removed or guarded to dev mode. Ensure errors are properly reported to
the UI (which it does by setting error state). Similarly, remove any console.warn('⚠
25
Authentication failed...') in api-amplify.ts` unless needed for dev diagnostics . In
production-ready code, such logs should be minimized or behind a debug flag.
•
Verify Removal of All Mock References: After refactoring, the code should no longer check
useMockData anywhere for conditional logic (unless we explicitly keep a dev-only block). For
example, if previously getProjectsForCurrentUser did something like: if (useMockData)
return dummyProjects; else fetch from Dynamo , that should now be simplified to always
fetch from Dynamo (since we chose to drop dummy data). The fallback behavior can be an error
message (as currently implemented) rather than silently using stale mock info. We already see that
in the final code, an error state is shown on failure rather than any dummy projects, which aligns
with removing mock data from production 1
. We can thus delete any dummy data definitions that
might still exist. A quick sanity check is to search the code for the word "mock" or sample structures
one last time.
By the end of this step, the code responsible for data fetching will be lean and focused: ideally just the AWS
SDK calls and minimal glue. This not only makes the app faster (no intermediate layer or toggle overhead)
but also easier to maintain – there’s a single pathway for data.
Step 5: Update Configuration & Documentation
With code changes done, some config files and docs need updating:
•
Refresh README/Documentation: The main README should reflect the new setup. Remove any
references to running a mock server or any steps that are no longer relevant (“run in mock mode”
etc., if they existed). Add a note that the app requires AWS credentials or configuration to run, now
that it directly accesses AWS. For example, document the required environment variables (AWS
Access Key, Secret, etc.) and how to set them for local development. The AWS integration guide
already lists the needed secrets 26
; we can incorporate a concise version into the README for
developers.
•
GitHub Secrets and CI: Make sure the repository’s CI/CD (GitHub Actions or similar) is not
referencing removed files. For instance, if the build pipeline attempted to run a script for CORS or
used a mock data setup for tests, update those steps. The CI should now primarily run lint, tsc, tests,
and build. The Changelog indicates the commands to test and build 27
; we ensure our pipeline uses
those. Also, since we removed .pnpm-store , the CI caching strategy might change (it should
cache node_modules or PNPM store outside of git).
•
Ensure .gitignore is Up to Date: Add patterns for any new generated files (e.g., if we hadn’t ignored
.env.local or .pnpm-store , do so now). Also remove ignores for things that no longer apply
(perhaps if there was an entry for old mock data files, etc., though minor).
•
Reconfigure Environment Defaults: If we removed VITE_USE_MOCK and VITE_SKIP_AUTH
toggles from code, also remove them from any .env.example or config files. Conversely, if we
8
keep skipAuth for dev, ensure the default in .env example is false (which it is by requiring
explicit true). Clarify how to run the app in development: e.g., “By default, the app will connect to the
real AWS services. To run locally, you must configure AWS credentials (or set VITE_SKIP_AUTH=true
and provide a dummy environment for testing UI without login).” This guidance will help future devs not
scratch their head about how to get past the login if they don’t have Cognito setup (skipAuth can be
their answer, if we choose to keep that route).
•
Retain Test Credentials Securely: The production readiness report listed a test username/password
28
. If those are still intended for a staging environment, ensure they are not hard-coded anywhere
and perhaps remove them from public docs for security. It’s okay in an internal report, but we might
want to take that out of any public-facing README.
•
Document the New Structure: Create a short section in the README or a CONTRIBUTING.md to
outline the project structure after refactor. For example: “Project Structure: The code is organized
into src/components for UI components, src/services for data logic (AWS SDK calls), src/
types for type definitions, etc.” Listing this helps orient new contributors after we’ve moved things
around.
Step 6: Testing and Verification
After refactoring and cleanup, perform a full regression test:
•
Run Automated Tests: Execute pnpm test and ensure all tests pass. If some tests were written
against the old API or using mock data, they may need updates. For example, a test that assumed
useMockData might need to be adjusted to provide dummy data via dependency injection instead.
Update tests to align with the new code structure (import paths might have changed, etc.). The end-
to-end tests should still mostly pass if the UI behavior didn’t change. Recall that prior to this cleanup,
end-to-end tests were passing at ~92% 29
. We aim to maintain or improve that.
•
Manual Smoke Test: Run the app in development mode and click through the main user flows:
•
•
•
•
Log in (with Cognito or skipAuth if used), ensure the dashboard loads actual projects from
DynamoDB.
Generate an ACTA document and download it (if those still go through API, verify that works; if not
easily testable locally, ensure the function calls at least execute without error using dummy values).
Test both a PM user view and an admin view (the system was designed to show only the user's
projects vs all projects for admins 30
). If you have separate test accounts or a toggle to simulate
roles, try that.
Verify that error states display properly (e.g., break the network to Dynamo and see that the “Error
loading projects” message appears as expected, with no uncaught exceptions).
•
Performance Check: The cleanup might slightly reduce bundle size (removing unused code). It’s
good to run a build ( pnpm run build ) and check that the output is still optimal. The bundle
should include only the code we intend. If you inspect the build output, confirm that none of the
removed modules are present. For example, ensure that references to mockData or
9
dataService optimized 31
do not appear in the built app. The production bundle previously was ~2.5 MB and
; we expect it to remain in that range or smaller after removing dead code.
•
Deploy (if applicable): If there is an automated deployment (to S3/CloudFront), trigger a
deployment with the cleaned repository. Since infrastructure didn’t change, it should go smoothly.
Once deployed, do a quick test on the live app to ensure everything still works with real AWS
resources. All key features – project listing, document download, email workflow, etc. – should
function as before (or better).
Step 7: Outcome and Maintenance
By following this plan, the repository will be more maintainable and professional: - All obsolete code (legacy
API integration and dev mocks) will be gone, reducing confusion. New developers won’t accidentally call
deprecated functions because they simply won’t exist in the codebase. As noted, we have “removed all
legacy/mock-only code from production” already 4
– this takes it a step further by excising it from the
repo entirely. - The directory structure will be cleaner, with a clear separation of concerns (e.g., UI vs data
logic vs config). For example, someone looking for how data is fetched can go straight to src/services/
awsDataService.ts and see the DynamoDB queries, whereas someone wanting to tweak the UI layout
of project cards can go to src/components/projects/ProjectCard.tsx . - Build and deployment will
no longer carry along unnecessary baggage (like the .pnpm-store or giant mock datasets), possibly
improving build times and reducing repository size. - The use of environment flags will be streamlined. The
app will default to using real services, which encourages testing in a production-like manner. We’ve justified
that mocks beyond testing are generally not needed given a functional backend, so the code now reflects
that philosophy. - We have kept development conveniences where reasonable (like the ability to skip auth or
a toggle for mock mode) but in a way that won’t interfere or confuse. For instance, skipAuth is only
enabled if a dev explicitly turns it on in a local .env 15
, so production is safe. This kind of feature is
documented for developers.
Finally, going forward, it’s wise to periodically perform such cleanups. Every major feature or integration
(like this AWS migration) can leave behind remnants; cleaning them ensures the codebase stays lean,
clean, and focused on the current architecture. With this refactor, ACTA-UI’s repository is now well-prepared
for the next phases of development, such as adding new features or optimizing performance, without the
drag of outdated code. All team members – from engineering to UX/design to DevOps – should find it easier
to work with this codebase now that it’s organized and free of dead weight.
10
1 4 28 29 31
PRODUCTION_READINESS_REPORT.md
https://github.com/valencia94/acta-ui/blob/5cd7c4ce0d1f7299600120961ca6ca5cde46b71e/
PRODUCTION_READINESS_REPORT.md
2 5 26 30
AWS_SDK_INTEGRATION_COMPLETE.md
https://github.com/valencia94/acta-ui/blob/5cd7c4ce0d1f7299600120961ca6ca5cde46b71e/
AWS_SDK_INTEGRATION_COMPLETE.md
3 10
CORS_SETUP.md
https://github.com/valencia94/acta-ui/blob/5cd7c4ce0d1f7299600120961ca6ca5cde46b71e/CORS_SETUP.md
6 16
complete-aws-migration.js
https://github.com/valencia94/acta-ui/blob/5cd7c4ce0d1f7299600120961ca6ca5cde46b71e/scripts/complete-aws-migration.js
7 9
map-api-functions.js
https://github.com/valencia94/acta-ui/blob/5cd7c4ce0d1f7299600120961ca6ca5cde46b71e/scripts/map-api-functions.js
8
AWSDataDashboard.tsx
https://github.com/valencia94/acta-ui/blob/5cd7c4ce0d1f7299600120961ca6ca5cde46b71e/src/components/
AWSDataDashboard.tsx
11 15 23
env.variables.ts
https://github.com/valencia94/acta-ui/blob/5cd7c4ce0d1f7299600120961ca6ca5cde46b71e/src/env.variables.ts
12 13 24
DynamoProjectsView.tsx
https://github.com/valencia94/acta-ui/blob/5cd7c4ce0d1f7299600120961ca6ca5cde46b71e/src/components/
DynamoProjectsView.tsx
14 17 21 22
api.ts
https://github.com/valencia94/acta-ui/blob/5cd7c4ce0d1f7299600120961ca6ca5cde46b71e/src/lib/api.ts
18 19 20 25
api-amplify.ts
https://github.com/valencia94/acta-ui/blob/5cd7c4ce0d1f7299600120961ca6ca5cde46b71e/src/api-amplify.ts
27
CHANGELOG.md
https://github.com/valencia94/acta-ui/blob/5cd7c4ce0d1f7299600120961ca6ca5cde46b71e/CHANGELOG.md
11
