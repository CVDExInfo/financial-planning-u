#!/usr/bin/env node
/**
 * scripts/validate-taxonomy-dynamo.cjs
 *
 * Compares frontend canonical taxonomy (src/lib/rubros/canonical-taxonomy.ts)
 * against live Dynamo table finz_rubros_taxonomia and reports:
 *  - missing IDs in Dynamo
 *  - extra IDs in Dynamo
 *  - attribute mismatches
 *  - PK mismatches (pk refers to another linea)
 *
 * Usage:
 *   AWS_REGION=us-east-2 TAXONOMY_TABLE=finz_rubros_taxonomia node scripts/validate-taxonomy-dynamo.cjs > report.json
 *
 * NOTE: This script performs a full table Scan of the taxonomy table.
 */

const fs = require('fs');
const path = require('path');
const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { unmarshall } = require('@aws-sdk/util-dynamodb');

const REGION = process.env.AWS_REGION || 'us-east-2';
const TABLE = process.env.TAXONOMY_TABLE || 'finz_rubros_taxonomia';
const FRONTEND_TAXONOMY_PATH = path.resolve(__dirname, '..', 'src', 'lib', 'rubros', 'canonical-taxonomy.ts');

function extractCanonicalFromFrontend(fileContent) {
  // Basic heuristic: find id: 'MOD-ING' and then gather nearby keys like linea_gasto, descripcion, categoria, categoria_codigo
  const entries = {};
  const lines = fileContent.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const idMatch = line.match(/id:\s*['"]([^'"]+)['"]/);
    if (idMatch) {
      const id = idMatch[1];
      // look +/-8 lines for fields
      const windowStart = Math.max(0, i - 8);
      const windowEnd = Math.min(lines.length - 1, i + 8);
      const obj = { id, linea_gasto: null, descripcion: null, categoria: null, categoria_codigo: null };
      for (let j = windowStart; j <= windowEnd; j++) {
        const l = lines[j];
        const lg = l.match(/linea_gasto:\s*['"]([^'"]+)['"]/);
        if (lg) obj.linea_gasto = lg[1];
        const desc = l.match(/descripcion:\s*['"]([^'"]+)['"]/);
        if (desc) obj.descripcion = desc[1];
        const cat = l.match(/categoria:\s*['"]([^'"]+)['"]/);
        if (cat) obj.categoria = cat[1];
        const catc = l.match(/categoria_codigo:\s*['"]([^'"]+)['"]/);
        if (catc) obj.categoria_codigo = catc[1];
      }
      entries[id] = obj;
    }
  }
  return entries;
}

async function scanTable(client) {
  const all = [];
  let ExclusiveStartKey = undefined;
  do {
    const out = await client.send(new ScanCommand({
      TableName: TABLE,
      ExclusiveStartKey,
    }));
    if (out.Items) {
      for (const it of out.Items) {
        all.push(unmarshall(it));
      }
    }
    ExclusiveStartKey = out.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return all;
}

(async () => {
  try {
    if (!fs.existsSync(FRONTEND_TAXONOMY_PATH)) {
      console.error('Frontend taxonomy file not found:', FRONTEND_TAXONOMY_PATH);
      process.exit(1);
    }
    const content = fs.readFileSync(FRONTEND_TAXONOMY_PATH, 'utf8');
    const frontendMap = extractCanonicalFromFrontend(content);
    const frontendIds = new Set(Object.keys(frontendMap));

    const ddb = new DynamoDBClient({ region: REGION });
    const items = await scanTable(ddb);

    // Map table items by linea_codigo and also by pk
    const tableByLinea = {};
    const tableByPk = {};
    for (const it of items) {
      // Detect linea code
      const linea = (it.linea_codigo && String(it.linea_codigo)) || null;
      const pk = (it.pk && String(it.pk)) || null;
      if (linea) {
        if (!tableByLinea[linea]) tableByLinea[linea] = [];
        tableByLinea[linea].push(it);
      }
      if (pk) {
        tableByPk[pk] = it;
      }
    }

    // Analysis
    const missingInDynamo = [];
    const mismatches = {}; // id -> {expected, foundAttributes...}
    for (const id of frontendIds) {
      const found = tableByLinea[id];
      if (!found || found.length === 0) {
        missingInDynamo.push(id);
      } else {
        // compare attributes with first item (if multiple SKs, we still compare)
        const a = frontendMap[id];
        const item = found[0];
        const diffs = [];
        // compare descripcion vs linea_gasto or descripcion
        const tableDescr = (item.descripcion || item.linea_gasto || '').trim();
        const frontDescr = (a.descripcion || a.linea_gasto || '').trim();
        if (frontDescr && tableDescr && frontDescr !== tableDescr) {
          diffs.push({ attr: 'descripcion/linea_gasto', frontend: frontDescr, table: tableDescr });
        } else if (frontDescr && !tableDescr) {
          diffs.push({ attr: 'descripcion/linea_gasto', frontend: frontDescr, table: null });
        }
        // categoria_codigo
        const tableCatCode = (item.categoria_codigo || item.categoriaCode || '').trim();
        const frontCatCode = (a.categoria_codigo || '').trim();
        if (frontCatCode && tableCatCode && frontCatCode !== tableCatCode) {
          diffs.push({ attr: 'categoria_codigo', frontend: frontCatCode, table: tableCatCode });
        } else if (frontCatCode && !tableCatCode) {
          diffs.push({ attr: 'categoria_codigo', frontend: frontCatCode, table: null });
        }
        // PK mismatch: check pk exists and starts with LINEA#id
        const foundPkProblem = [];
        const matching = found.filter(fi => {
          const fk = fi.pk || '';
          return String(fk).endsWith(`#${id}`) || String(fk) === `LINEA#${id}`;
        });
        if (matching.length === 0) {
          // record PKs of the found items to show mismatch
          const pks = found.map(fi => fi.pk || null);
          diffs.push({ attr: 'pk', info: 'pk not matching LINEA#<id>', pks });
        }
        if (diffs.length) {
          mismatches[id] = { frontend: frontendMap[id], tableSample: found[0], diffs };
        }
      }
    }

    // Extra in table not in frontend
    const extraInTable = [];
    for (const linea of Object.keys(tableByLinea)) {
      if (!frontendIds.has(linea)) {
        extraInTable.push(linea);
      }
    }

    // Build report
    const report = {
      meta: {
        region: REGION,
        table: TABLE,
        frontendPath: FRONTEND_TAXONOMY_PATH,
        scannedItems: items.length,
        frontendCount: frontendIds.size,
        tableLineaCount: Object.keys(tableByLinea).length
      },
      missingInDynamo,
      mismatches,
      extraInTable,
      rawSample: {
        sampleFrontend: Object.entries(frontendMap).slice(0, 5).map(([k,v])=> ({id:k, ...v})),
        sampleTableItems: items.slice(0, 5)
      }
    };

    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Validation error:', err);
    process.exit(2);
  }
})();
