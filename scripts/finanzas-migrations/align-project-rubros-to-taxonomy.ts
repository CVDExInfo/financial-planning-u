/**
 * Migration Script: Align Project Rubros to Canonical Taxonomy
 * 
 * This script scans all project_rubros records in DynamoDB and aligns them
 * with the canonical rubros taxonomy by:
 * 1. Mapping legacy rubro_ids to canonical linea_codigo
 * 2. Updating records with canonical IDs
 * 3. Logging unmapped rubros for manual review
 * 
 * SAFETY:
 * - Idempotent: can be run multiple times safely
 * - No deletions: only updates rubro_id fields
 * - Dry-run mode: test before applying changes
 * - Audit logging: all changes are logged
 * 
 * Usage:
 *   tsx scripts/finanzas-migrations/align-project-rubros-to-taxonomy.ts [--dry-run] [--table-name=<name>]
 */

import { DynamoDBClient, ScanCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall, marshall } from "@aws-sdk/util-dynamodb";

// Legacy mapping - maps old rubro_ids to canonical linea_codigo
const LEGACY_RUBRO_ID_MAP: Record<string, string> = {
  // Old simple format (from finanzas/data/rubros.taxonomia.ts)
  'RUBRO-001': 'MOD-ING',
  'RUBRO-002': 'TEC-HW-FIELD',
  'RUBRO-003': 'TEC-LIC-MON',
  'RUBRO-004': 'GSV-REU',
  'RUBRO-005': 'GSV-TRN',
  
  // Old catalog format (RB#### from rubros.catalog.ts)
  'RB0001': 'MOD-ING',
  'RB0002': 'MOD-LEAD',
  'RB0003': 'MOD-SDM',
  'RB0004': 'MOD-OT',
  'RB0005': 'MOD-CONT',
  'RB0006': 'MOD-EXT',
  'RB0007': 'GSV-REU',
  'RB0008': 'GSV-RPT',
  'RB0009': 'GSV-AUD',
  'RB0010': 'GSV-TRN',
  'RB0011': 'REM-MANT-P',
  'RB0012': 'REM-MANT-C',
  'RB0013': 'REM-HH-EXT',
  'RB0014': 'REM-TRNS',
  'RB0015': 'REM-VIAT',
  'RB0016': 'REM-CONS',
  'RB0017': 'TEC-LIC-MON',
  'RB0018': 'TEC-ITSM',
  'RB0019': 'TEC-LAB',
  'RB0020': 'TEC-HW-RPL',
  'RB0021': 'TEC-HW-FIELD',
  'RB0022': 'TEC-SUP-VND',
  'RB0023': 'INF-CLOUD',
  'RB0024': 'INF-DC-EN',
  'RB0025': 'INF-RACK',
  'RB0026': 'INF-BCK',
  'RB0027': 'TEL-CCTS',
  'RB0028': 'TEL-UCAAS',
  'RB0029': 'TEL-SIMS',
  'RB0030': 'TEL-NUM',
  'RB0031': 'SEC-SOC',
  'RB0032': 'SEC-VA',
  'RB0033': 'SEC-COMP',
  'RB0034': 'LOG-SPARES',
  'RB0035': 'LOG-RMA',
  'RB0036': 'LOG-ENV',
  'RB0037': 'RIE-PEN',
  'RB0038': 'RIE-CTR',
  'RB0039': 'RIE-SEG',
  'RB0040': 'ADM-PMO',
  'RB0041': 'ADM-BILL',
  'RB0042': 'ADM-FIN',
  'RB0043': 'ADM-LIC',
  'RB0044': 'ADM-LEG',
  'RB0045': 'QLT-ISO',
  'RB0046': 'QLT-KAIZ',
  'RB0047': 'QLT-SAT',
  'RB0048': 'PLT-PLANV',
  'RB0049': 'PLT-SFDC',
  'RB0050': 'PLT-SAP',
  'RB0051': 'PLT-DLAKE',
  'RB0052': 'DEP-HW',
  'RB0053': 'DEP-SW',
  'RB0054': 'NOC-MON',
  'RB0055': 'NOC-ALR',
  'RB0056': 'NOC-PLN',
  'RB0057': 'COL-UCC',
  'RB0058': 'COL-STG',
  'RB0059': 'COL-EMAIL',
  'RB0060': 'VIA-INT',
  'RB0061': 'VIA-CLI',
  'RB0062': 'INV-ALM',
  'RB0063': 'INV-SGA',
  'RB0064': 'INV-SEG',
  'RB0065': 'LIC-FW',
  'RB0066': 'LIC-NET',
  'RB0067': 'LIC-EDR',
  'RB0068': 'CTR-SLA',
  'RB0069': 'CTR-OLA',
  'RB0070': 'INN-POC',
  'RB0071': 'INN-AUT',
  
  // Old seed format
  'RUBRO-SENIOR-DEV': 'MOD-LEAD',
  'RUBRO-AWS-INFRA': 'INF-CLOUD',
  'RUBRO-LICENSE': 'TEC-LIC-MON',
  'RUBRO-CONSULTING': 'GSV-REU',
};

// Canonical taxonomy IDs (for validation)
const CANONICAL_IDS = new Set([
  'MOD-ING', 'MOD-LEAD', 'MOD-SDM', 'MOD-PM', 'MOD-OT', 'MOD-CONT', 'MOD-EXT',
  'GSV-REU', 'GSV-RPT', 'GSV-AUD', 'GSV-TRN',
  'REM-MANT-P', 'REM-MANT-C', 'REM-HH-EXT', 'REM-TRNS', 'REM-VIAT', 'REM-CONS',
  'TEC-LIC-MON', 'TEC-ITSM', 'TEC-LAB', 'TEC-HW-RPL', 'TEC-HW-FIELD', 'TEC-SUP-VND',
  'INF-CLOUD', 'INF-DC-EN', 'INF-RACK', 'INF-BCK',
  'TEL-CCTS', 'TEL-UCAAS', 'TEL-SIMS', 'TEL-NUM',
  'SEC-SOC', 'SEC-VA', 'SEC-COMP',
  'LOG-SPARES', 'LOG-RMA', 'LOG-ENV',
  'RIE-PEN', 'RIE-CTR', 'RIE-SEG',
  'ADM-PMO', 'ADM-BILL', 'ADM-FIN', 'ADM-LIC', 'ADM-LEG',
  'QLT-ISO', 'QLT-KAIZ', 'QLT-SAT',
  'PLT-PLANV', 'PLT-SFDC', 'PLT-SAP', 'PLT-DLAKE',
  'DEP-HW', 'DEP-SW',
  'NOC-MON', 'NOC-ALR', 'NOC-PLN',
  'COL-UCC', 'COL-STG', 'COL-EMAIL',
  'VIA-INT', 'VIA-CLI',
  'INV-ALM', 'INV-SGA', 'INV-SEG',
  'LIC-FW', 'LIC-NET', 'LIC-EDR',
  'CTR-SLA', 'CTR-OLA',
  'INN-POC', 'INN-AUT',
]);

interface MigrationStats {
  scanned: number;
  alreadyCanonical: number;
  mapped: number;
  updated: number;
  unmapped: number;
  errors: number;
}

interface UnmappedRubro {
  projectId: string;
  rubroId: string;
  pk: string;
  sk: string;
  qty?: number;
  unit_cost?: number;
  total_cost?: number;
}

async function alignProjectRubros(
  tableName: string,
  dryRun: boolean = true
): Promise<void> {
  const region = process.env.AWS_REGION || "us-east-2";
  const client = new DynamoDBClient({ region });

  console.log(`\n🔍 Scanning table: ${tableName}`);
  console.log(`📋 Mode: ${dryRun ? "DRY-RUN (no changes)" : "APPLY CHANGES"}`);
  console.log(`🌍 Region: ${region}\n`);

  const stats: MigrationStats = {
    scanned: 0,
    alreadyCanonical: 0,
    mapped: 0,
    updated: 0,
    unmapped: 0,
    errors: 0,
  };

  const unmappedRubros: UnmappedRubro[] = [];
  const updates: Array<{ old: string; new: string; project: string }> = [];

  try {
    // Scan all items in the rubros table
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;

    do {
      const scanResult = await client.send(
        new ScanCommand({
          TableName: tableName,
          FilterExpression: "begins_with(#pk, :projectPrefix) AND begins_with(#sk, :rubroPrefix)",
          ExpressionAttributeNames: {
            "#pk": "pk",
            "#sk": "sk",
          },
          ExpressionAttributeValues: marshall({
            ":projectPrefix": "PROJECT#",
            ":rubroPrefix": "RUBRO#",
          }),
          ExclusiveStartKey: lastEvaluatedKey,
        })
      );

      const items = (scanResult.Items || []).map((item) => unmarshall(item));
      stats.scanned += items.length;

      for (const item of items) {
        const projectId = item.projectId || item.project_id || (item.pk ? item.pk.replace("PROJECT#", "") : "");
        const currentRubroId = item.rubroId || item.rubro_id || "";

        if (!currentRubroId) {
          console.warn(`⚠️  Missing rubroId for item: ${JSON.stringify(item)}`);
          stats.errors++;
          continue;
        }

        // Check if already canonical
        if (CANONICAL_IDS.has(currentRubroId)) {
          stats.alreadyCanonical++;
          continue;
        }

        // Try to map legacy ID to canonical
        const canonicalId = LEGACY_RUBRO_ID_MAP[currentRubroId];

        if (canonicalId) {
          // Found mapping
          stats.mapped++;
          updates.push({
            old: currentRubroId,
            new: canonicalId,
            project: projectId,
          });

          if (!dryRun) {
            // Apply update
            try {
              await client.send(
                new UpdateItemCommand({
                  TableName: tableName,
                  Key: marshall({
                    pk: item.pk,
                    sk: `RUBRO#${canonicalId}`,
                  }),
                  UpdateExpression: "SET rubroId = :newId, rubro_id = :newId, updated_at = :timestamp",
                  ExpressionAttributeValues: marshall({
                    ":newId": canonicalId,
                    ":timestamp": new Date().toISOString(),
                  }),
                })
              );
              stats.updated++;
              console.log(`✅ Updated: ${projectId} | ${currentRubroId} → ${canonicalId}`);
            } catch (error) {
              console.error(`❌ Failed to update ${projectId}/${currentRubroId}:`, error);
              stats.errors++;
            }
          } else {
            console.log(`[DRY-RUN] Would update: ${projectId} | ${currentRubroId} → ${canonicalId}`);
          }
        } else {
          // No mapping found
          stats.unmapped++;
          unmappedRubros.push({
            projectId,
            rubroId: currentRubroId,
            pk: item.pk,
            sk: item.sk,
            qty: item.qty,
            unit_cost: item.unit_cost,
            total_cost: item.total_cost,
          });
          console.warn(`⚠️  Unmapped rubro: ${projectId} | ${currentRubroId}`);
        }
      }

      lastEvaluatedKey = scanResult.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    // Print summary
    console.log(`\n📊 Migration Summary:`);
    console.log(`   Scanned: ${stats.scanned}`);
    console.log(`   Already canonical: ${stats.alreadyCanonical}`);
    console.log(`   Mapped (legacy → canonical): ${stats.mapped}`);
    console.log(`   Updated: ${stats.updated}`);
    console.log(`   Unmapped: ${stats.unmapped}`);
    console.log(`   Errors: ${stats.errors}`);

    // Save unmapped rubros report
    if (unmappedRubros.length > 0) {
      const reportPath = `/tmp/unmapped-rubros-${Date.now()}.json`;
      const fs = await import('fs');
      fs.writeFileSync(reportPath, JSON.stringify(unmappedRubros, null, 2));
      console.log(`\n📄 Unmapped rubros report saved to: ${reportPath}`);
      console.log(`   Review this file and add mappings to LEGACY_RUBRO_ID_MAP if needed.`);
    }

    // Save updates log
    if (updates.length > 0 && !dryRun) {
      const updatesPath = `/tmp/rubros-updates-${Date.now()}.json`;
      const fs = await import('fs');
      fs.writeFileSync(updatesPath, JSON.stringify(updates, null, 2));
      console.log(`\n📄 Updates log saved to: ${updatesPath}`);
    }

    if (dryRun) {
      console.log(`\n✅ Dry-run complete. Run without --dry-run to apply changes.`);
    } else {
      console.log(`\n✅ Migration complete!`);
    }
  } catch (error) {
    console.error(`\n❌ Migration failed:`, error);
    throw error;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const tableArg = args.find((arg) => arg.startsWith("--table-name="));
const tableName = tableArg
  ? tableArg.split("=")[1]
  : process.env.RUBROS_TABLE || "Finanzas-Rubros-dev";

// Run migration
if (require.main === module) {
  alignProjectRubros(tableName, dryRun)
    .then(() => {
      console.log("Done!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}

export { alignProjectRubros };
