#!/usr/bin/env node
/**
 * scripts/sync-taxonomy-to-dynamo.cjs
 * 
 * Upserts taxonomy entries into finz_rubros_taxonomia from the frontend canonical taxonomy file.
 * This is an ops helper script - run manually when you need to seed or sync the DynamoDB table.
 * 
 * IMPORTANT: Only run this when you have validated the canonical data and have appropriate permission.
 * This will modify data in production DynamoDB.
 * 
 * Usage:
 *   AWS_REGION=us-east-2 TAXONOMY_TABLE=finz_rubros_taxonomia node scripts/sync-taxonomy-to-dynamo.cjs
 */

const fs = require('fs');
const path = require('path');
const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall } = require('@aws-sdk/util-dynamodb');

const REGION = process.env.AWS_REGION || 'us-east-2';
const TABLE = process.env.TAXONOMY_TABLE || 'finz_rubros_taxonomia';
const FRONTEND_PATH = path.resolve(__dirname, '..', 'src', 'lib', 'rubros', 'canonical-taxonomy.ts');
const DEFAULT_CATEGORY = 'UNASSIGNED';

function parseCanonicalFile(content) {
  // Extract IDs from patterns like: id: 'MOD-ING' or id: "MOD-ING"
  const ids = [];
  const re = /id:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    ids.push(m[1]);
  }
  return ids;
}

(async () => {
  if (!fs.existsSync(FRONTEND_PATH)) {
    console.error('Frontend canonical taxonomy file not found:', FRONTEND_PATH);
    process.exit(1);
  }
  const content = fs.readFileSync(FRONTEND_PATH, 'utf8');
  const ids = parseCanonicalFile(content);
  console.log('Found ids:', ids.length);

  const client = new DynamoDBClient({ region: REGION });

  for (const id of ids) {
    const item = {
      linea_codigo: id,
      // minimal seed — operators should enrich these rows via proper tooling
      descripcion: id,
      categoria: DEFAULT_CATEGORY,
      createdAt: new Date().toISOString(),
    };

    const cmd = new PutItemCommand({
      TableName: TABLE,
      Item: marshall(item),
    });
    try {
      await client.send(cmd);
      console.log('Upserted', id);
    } catch (err) {
      console.error('Failed to upsert', id, err);
    }
  }
  console.log('Done seed');
})();
