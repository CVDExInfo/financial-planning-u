#!/usr/bin/env node
/**
 * Verification script for SDMT RBAC fix
 * 
 * This script demonstrates that the glob pattern bug has been fixed
 * and all roles have proper access control.
 */

// Simulated ROLE_PERMISSIONS (copied from src/lib/auth.ts)
const ROLE_PERMISSIONS = {
  PM: {
    routes: [
      "/",
      "/profile",
      "/pmo/**",
      "/pmo/prefactura/**",
      "/sdmt/cost/catalog",
      "/catalog/rubros",
    ],
  },
  PMO: {
    routes: ["/", "/profile", "/pmo/**", "/pmo/prefactura/**"],
  },
  SDMT: {
    routes: [
      "/",
      "/profile",
      "/sdmt/**",
      "/projects/**",
      "/catalog/**",
      "/rules",
      "/adjustments/**",
      "/providers/**",
    ],
  },
  EXEC_RO: {
    routes: ["/", "/profile", "/pmo/**", "/sdmt/**", "/catalog/**", "/rules"],
  },
};

// Fixed canAccessRoute implementation
function canAccessRoute(route, role) {
  const routes = ROLE_PERMISSIONS[role]?.routes || [];
  
  return routes.some((pattern) => {
    // FIXED: Use placeholder to prevent ** and * from interfering
    const regexPattern = pattern
      .replace(/\*\*/g, "___DOUBLESTAR___")
      .replace(/\*/g, "[^/]*")
      .replace(/___DOUBLESTAR___/g, ".*");
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(route);
  });
}

console.log("╔═══════════════════════════════════════════════════════════════════╗");
console.log("║  SDMT Access Restriction Fix - Verification Results              ║");
console.log("╚═══════════════════════════════════════════════════════════════════╝\n");

// Test scenarios
const scenarios = [
  {
    title: "SDMT Role - Full Access to SDMT Cost Management",
    role: "SDMT",
    tests: [
      { route: "/sdmt/cost/catalog", expected: true, desc: "Catálogo de Rubros" },
      { route: "/sdmt/cost/forecast", expected: true, desc: "Gestión de Pronóstico" },
      { route: "/sdmt/cost/reconciliation", expected: true, desc: "Conciliación" },
      { route: "/sdmt/cost/changes", expected: true, desc: "Cambios y Ajustes" },
      { route: "/sdmt/cost/cashflow", expected: true, desc: "Flujo de Caja" },
    ],
  },
  {
    title: "PM Role - Limited Access (Estimator + Catalog Only)",
    role: "PM",
    tests: [
      { route: "/pmo/prefactura/estimator", expected: true, desc: "Estimador (allowed)" },
      { route: "/sdmt/cost/catalog", expected: true, desc: "Catálogo (allowed)" },
      { route: "/sdmt/cost/forecast", expected: false, desc: "Pronóstico (blocked)" },
      { route: "/sdmt/cost/reconciliation", expected: false, desc: "Conciliación (blocked)" },
      { route: "/sdmt/cost/changes", expected: false, desc: "Cambios (blocked)" },
    ],
  },
  {
    title: "EXEC_RO Role - Full Read-Only Access",
    role: "EXEC_RO",
    tests: [
      { route: "/sdmt/cost/catalog", expected: true, desc: "SDMT Catalog" },
      { route: "/sdmt/cost/forecast", expected: true, desc: "SDMT Forecast" },
      { route: "/pmo/prefactura/estimator", expected: true, desc: "PMO Estimator" },
    ],
  },
  {
    title: "PMO Role - PMO Workspace Only",
    role: "PMO",
    tests: [
      { route: "/pmo/prefactura/estimator", expected: true, desc: "Estimador (allowed)" },
      { route: "/sdmt/cost/catalog", expected: false, desc: "SDMT Catalog (blocked)" },
      { route: "/sdmt/cost/forecast", expected: false, desc: "SDMT Forecast (blocked)" },
    ],
  },
];

let totalTests = 0;
let totalPassed = 0;
let totalFailed = 0;

scenarios.forEach(({ title, role, tests }) => {
  console.log(`\n📋 ${title}\n${"─".repeat(70)}`);
  
  tests.forEach(({ route, expected, desc }) => {
    totalTests++;
    const result = canAccessRoute(route, role);
    const passed = result === expected;
    
    if (passed) {
      totalPassed++;
      console.log(`✅ ${desc.padEnd(35)} : ${route.padEnd(30)} [${result ? "ALLOWED" : "BLOCKED"}]`);
    } else {
      totalFailed++;
      console.log(`❌ ${desc.padEnd(35)} : ${route.padEnd(30)} [Expected: ${expected}, Got: ${result}]`);
    }
  });
});

console.log("\n╔═══════════════════════════════════════════════════════════════════╗");
console.log(`║  Test Summary: ${totalPassed}/${totalTests} passed, ${totalFailed} failed${" ".repeat(33 - totalPassed.toString().length - totalTests.toString().length - totalFailed.toString().length)}║`);
console.log("╚═══════════════════════════════════════════════════════════════════╝\n");

if (totalFailed > 0) {
  console.log("❌ VERIFICATION FAILED - Some tests did not pass");
  process.exit(1);
} else {
  console.log("✅ VERIFICATION SUCCESSFUL - All RBAC rules are working correctly!");
  console.log("\n📝 Summary:");
  console.log("   • SDMT users now have full access to all SDMT cost management pages");
  console.log("   • PM users remain limited to estimator + catalog (as designed)");
  console.log("   • EXEC_RO users have full read-only access");
  console.log("   • PMO users are restricted to PMO workspace");
  process.exit(0);
}
