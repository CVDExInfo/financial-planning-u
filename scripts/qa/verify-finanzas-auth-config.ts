#!/usr/bin/env node
import { readFileSync, existsSync, readdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const EXPECTED = {
  userPoolId: "us-east-2_FyHLtOhiY",
  domain: "us-east-2fyhltohiy.auth.us-east-2.amazoncognito.com",
  clientId: "dshos5iou44tuach7ta3ici5m",
  cloudfront: "https://d7t9x3j66yd8k.cloudfront.net",
  callbackPath: "/finanzas/auth/callback.html",
  signOutPath: "/finanzas/",
};

const files = {
  awsConfig: path.join(repoRoot, "src", "config", "aws.ts"),
  cloudfrontFunction: path.join(
    repoRoot,
    "infra",
    "cloudfront-function-finanzas-rewrite.js"
  ),
  canonicalCallback: path.join(repoRoot, "public", "auth", "callback.html"),
  legacyCallback: path.join(
    repoRoot,
    "public",
    "finanzas",
    "auth",
    "callback.html"
  ),
};

function fail(message: string): never {
  throw new Error(message);
}

function readFileOrFail(filePath: string, description: string): string {
  if (!existsSync(filePath)) {
    fail(`${description} is missing at ${path.relative(repoRoot, filePath)}`);
  }
  return readFileSync(filePath, "utf8");
}

function collectCallbackFiles(rootDir: string): string[] {
  if (!existsSync(rootDir)) {
    fail(`Public assets directory missing at ${path.relative(repoRoot, rootDir)}`);
  }
  const results: string[] = [];

  function walk(dir: string) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (
        entry.isFile() &&
        entry.name.toLowerCase() === "callback.html" &&
        fullPath.includes(`${path.sep}public${path.sep}`)
      ) {
        results.push(fullPath);
      }
    }
  }

  walk(rootDir);
  return results;
}

function assertIncludes(
  content: string,
  needles: string[],
  context: string
): void {
  needles.forEach((needle) => {
    if (!content.includes(needle)) {
      fail(`${context} is missing required text: ${needle}`);
    }
  });
}

function assertCallbackSync(
  canonicalPath: string,
  legacyPath: string,
  callbackFiles: string[]
): void {
  if (!existsSync(canonicalPath)) {
    fail(
      `Canonical callback HTML is missing. Expected at ${path.relative(
        repoRoot,
        canonicalPath
      )}. This file must render to /finanzas/auth/callback.html without introducing /finanzas/finanzas/auth/callback.html in the build output.`
    );
  }

  const canonicalContent = readFileSync(canonicalPath, "utf8").trim();
  const extras = callbackFiles.filter(
    (filePath) => path.resolve(filePath) !== path.resolve(canonicalPath)
  );

  for (const extra of extras) {
    const relativePath = path.relative(repoRoot, extra);
    const extraContent = readFileSync(extra, "utf8").trim();
    const isLegacyAlias = path.resolve(extra) === path.resolve(legacyPath);
    const redirectsToCanonical =
      extraContent.includes(EXPECTED.callbackPath) &&
      extraContent.toLowerCase().includes("meta") &&
      extraContent.toLowerCase().includes("refresh");

    if (isLegacyAlias) {
      const matchesCanonical = extraContent === canonicalContent;
      if (!(matchesCanonical || redirectsToCanonical)) {
        fail(
          `Legacy callback at ${relativePath} must match the canonical ${path.relative(
            repoRoot,
            canonicalPath
          )} or be a minimal redirect stub to ${EXPECTED.callbackPath}. Do not ship a second canonical under public/finanzas/auth/callback.html that would deploy to /finanzas/finanzas/auth/callback.html.`
        );
      }
      continue;
    }

    fail(
      `Unexpected callback file at ${relativePath}. Consolidate to ${path.relative(
        repoRoot,
        canonicalPath
      )} to avoid conflicting OAuth entrypoints.`
    );
  }
}

function validateAwsConfig(): void {
  const content = readFileOrFail(files.awsConfig, "AWS config (src/config/aws.ts)");

  assertIncludes(
    content,
    [EXPECTED.userPoolId, EXPECTED.domain, EXPECTED.clientId],
    "src/config/aws.ts"
  );

  assertIncludes(
    content,
    [EXPECTED.callbackPath],
    "src/config/aws.ts redirectSignIn"
  );

  if (!content.includes(EXPECTED.signOutPath)) {
    fail(
      `src/config/aws.ts redirectSignOut must stay under ${EXPECTED.signOutPath} (found no match).`
    );
  }

  if (!content.includes(EXPECTED.cloudfront)) {
    console.warn(
      "[QA] VITE_CLOUDFRONT_URL default not found; ensure environments set it explicitly."
    );
  }
}

function validateCloudfrontRewrite(): void {
  const content = readFileOrFail(
    files.cloudfrontFunction,
    "CloudFront rewrite function"
  );

  assertIncludes(
    content,
    ["/finanzas/index.html", EXPECTED.callbackPath],
    "CloudFront rewrite function"
  );

  if (!content.includes("uri.startsWith(\"/finanzas/\")")) {
    fail(
      "CloudFront rewrite must guard all /finanzas/ paths; missing startsWith('/finanzas/')."
    );
  }
}

function validateCallbackFiles(): void {
  const callbackFiles = collectCallbackFiles(path.join(repoRoot, "public"));
  assertCallbackSync(files.canonicalCallback, files.legacyCallback, callbackFiles);
}

function main(): void {
  try {
    validateAwsConfig();
    validateCloudfrontRewrite();
    validateCallbackFiles();

    console.log("✅ Finanzas auth config verification passed.");
  } catch (error) {
    console.error("❌ Finanzas auth config verification failed:");
    if (error instanceof Error) {
      console.error(`- ${error.message}`);
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

main();
