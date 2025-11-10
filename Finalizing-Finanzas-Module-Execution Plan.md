Finalizing Finanzas Module: Issue Breakdown and
Execution Plan
To ensure the remaining fixes are handled with clarity, parallelism, and high quality, we will split the work
into two issues. Each issue includes detailed instructions, context, guardrails, and requires evidence of
testing. Both issues will iterate until all tests pass and the Finanzas module is fully functional and live.
Issue 1: Finanzas Portal Deployment Finalization & Verification
Objective:  Finalize the deployment configuration for the Finanzas UI and verify end-to-end functionality in
the  production  environment.  This  includes  cloud  infrastructure  checks,  data  seeding,  and  UI  behavior
verification.
Tasks & Acceptance Criteria:
CloudFront Configuration:  Ensure the CloudFront distribution has a dedicated behavior for the
Finanzas  SPA path. Verify that a  /finanzas/*  behavior is present, pointing to the correct S3
origin (e.g. the  ukusi-ui-finanzas-prod  bucket). If this behavior is missing, add it (via AWS
Console or CLI) . Confirm that error responses for the  /finanzas/*  path are set to serve  /
finanzas/index.html  on 403/404 (SPA fallback).
S3 Content Validation:  Verify the S3 bucket contains the Finanzas frontend files under the proper
path. The bucket  ukusi-ui-finanzas-prod  should have the  finanzas/index.html  and an
assets/  subfolder with the JS/CSS bundles . Confirm the main app’s files remain at the root of
the primary bucket, and Finanzas files are under /finanzas/  as expected.
Cognito Callback URLs:  Update the Cognito User Pool App Client settings to include the Finanzas
URL. Both the Allowed Callback URL  and Allowed Sign-out URL  must have the CloudFront Finanzas
path ( .../finanzas/ ) in addition to the root URL . This ensures that after login or logout,
users are correctly redirected to the Finanzas portal path.
Data Seeding (Rubros & Rules):  Ensure that the DynamoDB tables for Finanzas are properly seeded
with initial data. The finz_rubros  table should contain all 71 budget categories (rubros)  so that
the /catalog/rubros  API returns the full list . Likewise, seed any essential data for allocation
rules (e.g. if expecting 2 default rules, ensure finz_projects /finz_rules  tables have those).
This data is needed for the UI to display the catalog and rules pages correctly.
UI Functional Checks:  Once the above configuration is in place, perform a full smoke test  of the
Finanzas UI in the production environment, covering at least: • 
1
• 
2
• 
3
• 
4
• 
1

Login Flow:  Navigate to the Finanzas URL and log in via Cognito. Upon successful auth, the app
should redirect to the /finanzas/  home page (not the main app root) and display the Finanzas
dashboard . 
Navigation:  Verify that Finanzas-specific navigation items are visible (for users with the appropriate
roles) and function correctly. For example, the “Rubros” link should navigate to /finanzas/
catalog/rubros  and display the Rubros table; the “Rules” link should go to /finanzas/rules
and display the rules data . 
API Responses:  Confirm the UI is loading data from the API successfully. For instance, visiting the
Rubros page should trigger a GET /catalog/rubros  and render 71 items (the full list of rubros)
. Likewise, the Rules page should trigger GET /allocation-rules  and show the expected
number of rule entries (e.g. 2) . No errors or 401s should occur for these calls (rubros is a public
endpoint; rules require a Cognito IdToken which the app should send). 
General UX:  Check that the UI has no broken links, assets load with the  /finanzas/  prefix
(ensure no 404s on JS/CSS), and that features like search, sorting, or any charts/reports in the
Finanzas  module  behave  as  expected.  All  acceptance  criteria  from  the  QA  checklist  should  be
satisfied (authentication, navigation, data display, etc.) .
Automated Verification:  Run the provided verification scripts to systematically test the deployment:
Execute the deployment verification script ( scripts/verify-deployment.sh ) or the end-to-end
smoke test ( scripts/finanzas-e2e-smoke.sh ) included in the repository. These will
programmatically check CloudFront behavior , S3 contents, and exercise key API endpoints .
Ensure that the script reports all checks as passed ( ) with no failures. In particular , the final
summary should confirm Cognito auth, API connectivity, Lambda processing, and DynamoDB
persistence all succeed . 
Inspect  the  script  output  for  any  warnings  (⚠)  or  errors  ( ).  If  any  are  present,  address  the
underlying issues (for example, if the script warns that the /finanzas/*  CloudFront behavior is
missing or a DynamoDB record wasn’t found, fix those configurations and run the script again) .
The goal is to have the verification script end in all green checks.
Organize  Critical  Artifacts:  As  a  final  housekeeping  step,  ensure  that  important  deployment
documentation and scripts  are easily accessible in the repository (not buried in obscure or archived
locations).  For  example,  keep  the  Finanzas  verification  guides  (such  as  a
FINANZAS_DEPLOYMENT_VERIFICATION.md  or similar) in a clearly named folder to denote their
importance .  This  could  mean  creating  a  docs/finanzas-release/  directory  (or  another
obvious location) for all final deployment notes and scripts, so future maintainers can quickly find
them.
Evidence & Iteration:  Provide test evidence for each step and iterate until everything is confirmed working:
Cloud Configuration Proof:  After updating CloudFront and Cognito, capture evidence of the new
settings. For example, take a screenshot or console output showing the CloudFront behaviors list
with the /finanzas/*  entry, and the Cognito App Client settings including the Finanzas URLs . 
Verification Script Output:  Attach the output of the deployment verification script or smoke test,
showing all sections passing. Key points to demonstrate include a 200 OK  for the Finanzas URL,• 
5
• 
6
• 
7
8
• 
9
• 
• 
1011
12
• 
13
• 
14
• 
15
• 
2

successful retrieval of Rubros data (e.g. seeing “  GET /catalog/rubros → 200” with count 71), and
confirmation that any expected test records are present in DynamoDB . 
UI Manual Test Results:  Document the results of the manual UI tests. For example: “After login, the
user is redirected to /finanzas/  (  screenshot attached), the Rubros page displays 71 entries ( ),
the Rules page shows 2 rules ( ), and no errors were observed in the browser console.” Provide
screenshots where applicable to verify these outcomes. 
Iterate if Needed:  If any step fails or an acceptance criterion is not met, do not consider the issue
resolved. Instead, leave a comment detailing the failure, implement a fix, and re-run the relevant
test. Continue this cycle of fix-and-test until all tests pass and every item in the acceptance criteria
(and the QA checklist) is checked off . The issue is only done when “Finanzas is live and
working correctly” on all fronts in production.
Guardrails:  The agent (or developer) working on this issue should proceed methodically and verify at each
step . If something is unclear (for example, how to add a CloudFront behavior via AWS CLI), pause and
seek guidance  rather than making risky guesses. Be careful when adjusting production settings: no change
should be considered complete until its effect is validated in the live environment (e.g., don’t assume
Cognito is configured correctly—actually perform a login to confirm it). By the end, we require concrete
evidence that the Finanzas module is fully functional in production, with zero regressions.
Issue 2: CI/CD Guardrails & PR Quality Gates for Finanzas
Objective:  Implement automated quality gates and guardrails in the development workflow to maintain
the integrity of the Finanzas module going forward. This issue focuses on updating CI/CD pipelines, testing
procedures, and repository settings so that any future changes to Finanzas are properly validated and do
not regress the deployment.
Tasks & Acceptance Criteria:
Build Guards in CI:  Augment the frontend build process with automated checks to catch common
configuration issues before deployment: 
Base Path Verification:  After building the Finanzas app, add a step in CI to ensure the generated 
index.html  and asset links use the /finanzas/  base path . For example, the CI workflow can
grep the built index.html  for "/finanzas/assets/" . If any asset URLs are missing the /
finanzas  prefix (indicating a misconfigured base path), the build should fail . (This guard
was outlined in the deployment guide; now we will enforce it automatically in CI.) 
Hardcoded URL Checks:  Similarly, include a check to ensure no development or temporary URLs
have leaked into the production build. The CI step should search the build output for strings like 
github.dev , codespaces , or any githubusercontent  links, and fail if found . This
prevents unintended references to development environments from reaching production assets. 
Environment Variables Validation:  If not already in place, add a pre-build step that validates all
required  env  vars  for  Finanzas  are  present  and  correctly  set  for  the  target  environment  (e.g.,
VITE_API_BASE_URL , VITE_FINZ_ENABLED , etc.). The goal is to catch misconfiguration (missing
or wrong env variables) before deployment . If any required variable is absent or empty in the
build context, the workflow should error out with a clear message.16
• 
• 
1718
19
• 
• 
2021
• 
22
• 
23
3

Automated Test Workflow:  Set up or enhance the test pipeline to cover Finanzas functionality on
each PR: 
If a UI test workflow doesn’t exist, create one that runs on pull requests targeting the main branch.
At minimum, it should install dependencies, build the Finanzas UI, and run a suite of tests. If there
are existing unit tests  for the Finanzas UI, include them. If not, consider running a headless smoke
test  against a dev/staging environment: for example, use the existing finanzas-e2e-smoke.sh
in a dry-run or minimal mode to hit a dev API endpoint (maybe using a test Cognito user) . Even a
basic smoke check (e.g., hitting the /health  or /catalog/rubros  endpoints on a test
environment) can catch major issues. 
Alternatively (or additionally), incorporate a simpler check post-build: serve the  dist-finanzas
build output and ensure it responds on its health/status endpoint or contains expected strings in the
HTML. The key outcome is that every PR will automatically run through a battery of Finanzas-specific
checks  (build  correctness  and  basic  runtime/API  integration) .  This  dramatically  reduces  the
chance of merging a breaking change into main.
Branch Protection & PR Gating:  Configure repository settings to enforce these quality gates: 
Enable required status checks  on the main branch. Mark the new CI workflow(s) as “required” so
that a pull request cannot be merged  unless all checks pass . This means if any of the Finanzas
build guards or tests fail, the PR stays unmergeable until fixed, ensuring broken code never lands in 
main. 
Require peer review before merging. Activate branch protection rules that require at least 1
approving review  (or more for critical changes) before allowing a merge . This adds a human
quality gate in addition to automated tests. You may also enable code owner  review requirements
for Finanzas-related files if a CODEOWNERS file is set up. 
Optionally, include additional guardrails such as preventing direct pushes to  main (require all
changes via PR), or requiring linked issue references in PR descriptions if your workflow demands it.
The goal is to institutionalize careful review and testing for every change.
Documentation & Clarity:  Update or add documentation to reflect these CI/CD changes so the
team is aware of the new processes: 
Document the new CI checks and guardrails in a README or a dedicated workflow guide (e.g., 
WORKFLOW_SETUP.md  or an update to the existing CI/CD docs) . Include instructions for
developers on how to run Finanzas checks locally, what the CI will do on each PR, and how to
interpret or troubleshoot failures. For example, note that the build guard will fail if any asset path is
incorrect, or that the smoke test will fail if the /catalog/rubros  endpoint doesn’t return 71 items.
If any scripts were created or files moved as part of Issue 1 (for instance, if important verification
scripts or docs were relocated under a docs/finanzas  or scripts/finanzas  folder for clarity),
update any references in documentation to point to their new location . Ensure the team knows
where to find these artifacts. (E.g., if finanzas-e2e-smoke.sh  or the deployment guide moved,
update  the  README  or  docs  to  direct  readers  to  the  docs/finanzas-release/  folder  we
created.)• 
• 
24
• 
25
• 
• 
26
• 
27
• 
• 
• 
28
• 
29
4

Test the Gates:  After implementing the above, verify that the guardrails work as intended: 
Perform a test PR (you can use a throwaway branch) to ensure the new checks actually trigger and
block merges on failure. For example, intentionally introduce a benign misconfiguration (such as an
asset path without the /finanzas  prefix) in a test branch and open a PR . The expected result
is that the CI build guard should catch it and the PR’s checks will fail, thereby preventing merge. 
Conversely, demonstrate a successful PR run on a correct codebase. The CI should pass all required
checks on a branch with no issues. You should see the PR checks turn green. Only when all required
checks are green and at least one review is approved should the “Merge” button become enabled
(this confirms the branch protection rules are in effect). 
Check the branch protection settings in the repository to confirm they are active. For instance,
attempt to push directly to main and ensure it’s rejected, and look at the repository Settings ->
Branches to see that the rules (status checks, review requirement, etc.) are listed and enforced (you
can screenshot this for evidence).
Evidence & Iteration: (Just like Issue 1, each of these changes must be proven with evidence in the issue or PR,
and you should iteratively refine until all quality gates are effective.)  Provide the following evidence and be
prepared to iterate:
CI Workflow Changes:  Link to the CI workflow file changes (or include a snippet) showing the newly
added guard steps (the grep checks for base path and URL, env var validation, etc.) . For example,
in the GitHub Actions YAML, show the script or commands added for these checks. 
Branch Protection Settings:  Show the branch protection settings that were configured. A
screenshot or description of the Branch Protection Rules  page is sufficient – it should confirm that
required status checks are enabled (listing the names of the CI checks you've added) and that pull
request reviews are required . Include confirmation that “Include administrators”  is checked (so
even admins can’t bypass) and that direct pushes are disallowed (if configured).
PR Test Results:  Share the results of test PR runs for both a failing and passing scenario. For the
failing scenario, show the CI failing on the intentional error (e.g., an excerpt from the Actions log or a
screenshot of the PR status with a failing check). For the passing scenario, show a PR where all
checks are green. If possible, include an image of the PR interface where it says “All checks have
passed” and the merge is gated pending review . 
If any part of the CI/CD doesn’t work as intended on the first try, iterate  by adjusting the workflow
or scripts and run the tests again. Continue refining until all automated checks run reliably and catch
what they’re supposed to catch, and until the branch protection rules are verified to block merges on
failures . The outcome should be a sustainable CI pipeline that automatically enforces quality for
the Finanzas module, and evidence that it will catch misconfigurations while allowing  correct code
to merge.
Guardrails:  The agent (or developer) tackling this issue should be cautious when editing CI workflows and
repo settings . Always use a test branch for trying out CI changes to avoid breaking the main pipeline. Be
mindful that changes to branch protection or secrets can affect the whole team; communicate any such
changes clearly or document them in the issue. If uncertain how to implement a specific check (e.g., using
GitHub Actions to grep a file’s content), consult official documentation or look for examples — do not
disable or circumvent existing tests or linters in the name of adding new ones. The aim is to add safety, not
reduce it . This issue is complete when we have a robust CI/CD setup that automatically enforces quality
gates for Finanzas and we have documented proof that the system fails on bad code and passes on good• 
• 
30
• 
• 
• 
31
• 
32
• 
33
• 
34
35
5

code. All current Finanzas code should pass all new checks, demonstrating that the guardrails are effective
without blocking valid changes .
Each issue above is designed with clear scope so they can be executed in parallel by separate agents or
team members. The  folder structure and naming  (e.g. using a  docs/finanzas-release  folder for
critical docs) will ensure important artifacts are easy to find, reflecting their importance. The inclusion of
automatic PR gating  via branch protection and CI checks will prevent regressions and maintain high
quality. 
Next Steps:  Open these two issues in the repository. Attach or link the research documentation (as a
Markdown file in the repo, placed in the designated docs folder) if additional context is needed. Ensure that
whoever works on these issues follows the guardrails and provides the required test evidence. They should
iterate and not close the issues until all acceptance criteria are met, all tests are green, and the Finanzas
feature set both wows the customer  and stands on a sustainable, quality-controlled foundation. 
Finanzas Portal Deployment Finalization
& Verification
https://github.com/valencia94/financial-planning-u/issues/85
CI/CD Guardrails & PR Quality Gates for Finanzas
https://github.com/valencia94/financial-planning-u/issues/8735
1 2 3 4 5 6 7 8 910 11 12 13 14 15 16 17 18 19
20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35
6