#!/usr/bin/env node
/**
 * scripts/validate-taxonomy-sync.cjs
 *
 * Compares frontend canonical taxonomy ids against the DynamoDB table (finz_rubros_taxonomia).
 * Exit code 0 = OK, 2 = mismatch
 *
 * Requires AWS credentials in the environment (or GH action configure-aws-credentials)
 * Usage: node scripts/validate-taxonomy-sync.cjs
 */

const fs = require('fs');
const path = require('path');
const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { unmarshall } = require('@aws-sdk/util-dynamodb');

const REGION = process.env.AWS_REGION || 'us-east-2';
const TAXONOMY_TABLE = process.env.TAXONOMY_TABLE || 'finz_rubros_taxonomia';
const FRONTEND_TAXONOMY_PATH = path.resolve(__dirname, '..', 'src', 'lib', 'rubros', 'canonical-taxonomy.ts');

function extractIdsFromFrontend(fileContent) {
  // Extract IDs from patterns like: id: 'MOD-ING' or id: "MOD-LEAD"
  const ids = new Set();
  const re = /id:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(fileContent)) !== null) {
    ids.add(m[1]);
  }
  return ids;
}

async function scanTaxonomyTable() {
  const client = new DynamoDBClient({ region: REGION });
  const items = [];
  let ExclusiveStartKey = undefined;
  do {
    const cmd = new ScanCommand({
      TableName: TAXONOMY_TABLE,
      ProjectionExpression: 'linea_codigo, id, code, linea_codigo_alias, categoria, descripcion',
      ExclusiveStartKey,
    });
    const out = await client.send(cmd);
    (out.Items || []).forEach(i => items.push(unmarshall(i)));
    ExclusiveStartKey = out.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

(async () => {
  try {
    if (!fs.existsSync(FRONTEND_TAXONOMY_PATH)) {
      console.error('Frontend taxonomy file not found at:', FRONTEND_TAXONOMY_PATH);
      process.exit(1);
    }

    const frontendFile = fs.readFileSync(FRONTEND_TAXONOMY_PATH, 'utf8');
    const frontIds = extractIdsFromFrontend(frontendFile);

    console.log(`Frontend taxonomy IDs found: ${frontIds.size}`);

    const tableItems = await scanTaxonomyTable();
    const tableIds = new Set();

    tableItems.forEach(item => {
      // Try several possible attribute names
      const cand = item.linea_codigo || item.id || item.code || item.linea_codigo_alias || item.LineaCodigo;
      if (cand && typeof cand === 'string') tableIds.add(cand);
    });

    console.log(`Dynamo taxonomy IDs found: ${tableIds.size}`);

    const onlyFrontend = [...frontIds].filter(x => !tableIds.has(x));
    const onlyTable = [...tableIds].filter(x => !frontIds.has(x));

    if (onlyFrontend.length || onlyTable.length) {
      console.error('❌ Taxonomy mismatch detected between frontend and DynamoDB');
      if (onlyFrontend.length) {
        console.error('\n📍 Only in frontend:', onlyFrontend);
      }
      if (onlyTable.length) {
        console.error('\n📍 Only in DynamoDB:', onlyTable.slice(0, 200));
      }
      console.error('\n💡 Fix: ensure the Dynamo table (finz_rubros_taxonomia) contains the canonical IDs or update frontend taxonomy.');
      process.exit(2);
    }

    console.log('✅ Taxonomy sync: OK (frontend <-> DynamoDB)');
    process.exit(0);
  } catch (err) {
    console.error('Error validating taxonomy sync:', err);
    process.exit(3);
  }
})();
