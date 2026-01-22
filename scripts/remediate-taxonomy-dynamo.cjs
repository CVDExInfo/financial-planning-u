#!/usr/bin/env node
/**
 * scripts/remediate-taxonomy-dynamo.cjs
 *
 * Reads a validation report (JSON produced by validate-taxonomy-dynamo.cjs)
 * and interactively prompts to apply fixes:
 *  - update attribute mismatches with UpdateItem
 *  - create missing items with PutItem
 *  - fix PK mismatch by copying to correct PK and deleting old PK (copy-put + delete)
 *
 * Usage:
 * AWS_REGION=... TAXONOMY_TABLE=finz_rubros_taxonomia node scripts/remediate-taxonomy-dynamo.cjs report.json
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { DynamoDBClient, PutItemCommand, UpdateItemCommand, DeleteItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall } = require('@aws-sdk/util-dynamodb');

const REGION = process.env.AWS_REGION || 'us-east-2';
const TABLE = process.env.TAXONOMY_TABLE || 'finz_rubros_taxonomia';

if (process.argv.length < 3) {
  console.error('Usage: node scripts/remediate-taxonomy-dynamo.cjs report.json');
  process.exit(1);
}

function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(q, ans => { rl.close(); resolve(ans); }));
}

(async () => {
  try {
    const reportPath = process.argv[2];
    if (!fs.existsSync(reportPath)) {
      console.error('Report file not found:', reportPath);
      process.exit(1);
    }
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const client = new DynamoDBClient({ region: REGION });

    // 1) Fix mismatches
    for (const [id, obj] of Object.entries(report.mismatches || {})) {
      console.log(`\n--- ID: ${id} ---`);
      console.log('Frontend sample:', obj.frontend);
      console.log('Table sample:', obj.tableSample);
      console.log('Diffs:', obj.diffs);
      const ans = await ask(`Apply suggested updates for ${id}? (y/N): `);
      if (ans.toLowerCase() !== 'y') continue;

      // Build update expression based on diffs
      const updateAttrs = {};
      const idx = obj.diffs;
      for (const d of idx) {
        if (d.attr === 'descripcion/linea_gasto') {
          const newVal = obj.frontend.descripcion || obj.frontend.linea_gasto || null;
          if (newVal) updateAttrs.descripcion = newVal;
        }
        if (d.attr === 'categoria_codigo') {
          const newVal = obj.frontend.categoria_codigo || null;
          if (newVal) updateAttrs.categoria_codigo = newVal;
        }
        if (d.attr === 'pk') {
          // pk mismatch: create copy and delete old (handled below)
        }
      }

      // If pk mismatch present, perform copy-put-delete
      const hasPkDiff = (obj.diffs || []).some(d => d.attr === 'pk');
      if (hasPkDiff) {
        // create new PK value
        const desiredPk = `LINEA#${id}`;
        console.log('PK mismatch detected. Will copy item to new PK:', desiredPk);
        // Create a new item with desired PK using existing tableSample as base
        const newItem = Object.assign({}, obj.tableSample, { pk: desiredPk });
        // set sk if missing to default
        if (!newItem.sk) newItem.sk = `CATEGORIA#${(newItem.categoria_codigo || 'MOD')}`;
        // Put new item
        const putCmd = new PutItemCommand({
          TableName: TABLE,
          Item: marshall(newItem),
        });
        await client.send(putCmd);
        console.log('Created new item with pk:', desiredPk);
        // Now delete old PK
        if (obj.tableSample && obj.tableSample.pk && obj.tableSample.sk) {
          const delCmd = new DeleteItemCommand({
            TableName: TABLE,
            Key: marshall({ pk: obj.tableSample.pk, sk: obj.tableSample.sk }),
          });
          await client.send(delCmd);
          console.log('Deleted old item with pk:', obj.tableSample.pk);
        } else {
          console.warn('Old item lacked pk/sk — please manually delete old item');
        }
      }

      // Apply attribute updates if any
      if (Object.keys(updateAttrs).length > 0) {
        const key = { pk: obj.tableSample.pk, sk: obj.tableSample.sk };
        const expr = [];
        const attrNames = {};
        const attrValues = {};
        let cnt = 0;
        for (const [k, v] of Object.entries(updateAttrs)) {
          cnt++;
          const nameKey = `#n${cnt}`;
          const valKey = `:v${cnt}`;
          expr.push(`${nameKey} = ${valKey}`);
          attrNames[nameKey] = k;
          attrValues[valKey] = { S: String(v) };
        }
        const updateExpression = 'SET ' + expr.join(', ');
        const updateCmd = new UpdateItemCommand({
          TableName: TABLE,
          Key: marshall(key),
          UpdateExpression: updateExpression,
          ExpressionAttributeNames: attrNames,
          ExpressionAttributeValues: attrValues,
        });
        await client.send(updateCmd);
        console.log('Updated attributes for pk:', obj.tableSample.pk, 'sk:', obj.tableSample.sk);
      }
    }

    // 2) Create missing items
    if ((report.missingInDynamo || []).length) {
      console.log('\nMissing IDs in Dynamo:', report.missingInDynamo.length);
      for (const id of report.missingInDynamo) {
        console.log('Missing:', id);
        const ans = await ask(`Create a minimal item for ${id}? (y/N): `);
        if (ans.toLowerCase() !== 'y') continue;
        // Try to get frontend sample from report
        const frontend = (report.rawSample && report.rawSample.sampleFrontend.find(s=>s.id===id)) || null;
        const newItem = {
          pk: `LINEA#${id}`,
          sk: `CATEGORIA#${(frontend && frontend.categoria_codigo) || 'MOD'}`,
          linea_codigo: id,
          linea_gasto: (frontend && frontend.linea_gasto) || (frontend && frontend.descripcion) || id,
          descripcion: (frontend && frontend.descripcion) || (frontend && frontend.linea_gasto) || id,
          categoria: (frontend && frontend.categoria) || 'Mano de Obra Directa',
          categoria_codigo: (frontend && frontend.categoria_codigo) || 'MOD',
          tipo_costo: 'OPEX',
          tipo_ejecucion: 'mensual',
          createdAt: new Date().toISOString(),
        };
        const put = new PutItemCommand({
          TableName: TABLE,
          Item: marshall(newItem),
        });
        await client.send(put);
        console.log('Created item for', id);
      }
    }

    // 3) Extra items: show but do not delete automatically (manual review)
    if ((report.extraInTable || []).length) {
      console.log('\nExtra items present in Dynamo but not in canonical frontend:', report.extraInTable.length);
      console.log('List (first 50):', report.extraInTable.slice(0,50));
      console.log('Manual review recommended for extras.');
    }

    console.log('Remediation done.');
    process.exit(0);
  } catch (err) {
    console.error('Remediation error:', err);
    process.exit(2);
  }
})();
