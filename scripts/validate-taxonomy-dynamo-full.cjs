#!/usr/bin/env node
// scripts/validate-taxonomy-dynamo-full.cjs
// Usage:
// AWS_REGION=us-east-2 TAXONOMY_TABLE=finz_rubros_taxonomia node scripts/validate-taxonomy-dynamo-full.cjs
const fs = require('fs');
const path = require('path');
const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { unmarshall } = require('@aws-sdk/util-dynamodb');

const REGION = process.env.AWS_REGION || 'us-east-2';
const TABLE = process.env.TAXONOMY_TABLE || 'finz_rubros_taxonomia';

function parseFrontendCanonical(content) {
  const entries = {};
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const idm = lines[i].match(/id:\s*['"]([^'"]+)['"]/);
    if (!idm) continue;
    const id = idm[1];
    const obj = { id, linea_gasto: null, descripcion: null, categoria: null, categoria_codigo: null, fuente_referencia: null, tipo_ejecucion: null, tipo_costo: null };
    const start = Math.max(0, i - 12), end = Math.min(lines.length - 1, i + 12);
    for (let j = start; j <= end; j++) {
      const l = lines[j];
      const lg = l.match(/linea_gasto:\s*['"]([^'"]+)['"]/);
      if (lg) obj.linea_gasto = lg[1];
      const desc = l.match(/descripcion:\s*['"]([^'"]+)['"]/);
      if (desc) obj.descripcion = desc[1];
      const cat = l.match(/categoria:\s*['"]([^'"]+)['"]/);
      if (cat) obj.categoria = cat[1];
      const catc = l.match(/categoria_codigo:\s*['"]([^'"]+)['"]/);
      if (catc) obj.categoria_codigo = catc[1];
      const fuente = l.match(/fuente_referencia:\s*['"]([^'"]+)['"]/);
      if (fuente) obj.fuente_referencia = fuente[1];
      const te = l.match(/tipo_ejecucion:\s*['"]([^'"]+)['"]/);
      if (te) obj.tipo_ejecucion = te[1];
      const tc = l.match(/tipo_costo:\s*['"]([^'"]+)['"]/);
      if (tc) obj.tipo_costo = tc[1];
    }
    entries[id] = obj;
  }
  return entries;
}

function parseBackendRubrosTaxonomy(content) {
  const result = { roleToLinea: {}, nonLabor: {}, defaults: {} };
  // role maps - handle both const and export const, with TypeScript Record<...> type
  const roleBlock = content.match(/(?:export\s+)?const\s+MOD_ROLE_TO_LINEA_CODIGO\s*:\s*Record<[^>]+>\s*=\s*{([\s\S]*?)};/m);
  if (roleBlock) {
    const m = roleBlock[1].matchAll(/['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g);
    for (const it of m) result.roleToLinea[it[1]] = it[2];
  }
  // non labor map - handle TypeScript Record<...> type
  const nonlabBlock = content.match(/(?:export\s+)?const\s+NON_LABOR_CATEGORY_MAP\s*:\s*Record<[^>]+>\s*=\s*{([\s\S]*?)};/m);
  if (nonlabBlock) {
    const m = nonlabBlock[1].matchAll(/['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g);
    for (const it of m) result.nonLabor[it[1]] = it[2];
  }
  const d1 = content.match(/(?:export\s+)?const\s+DEFAULT_LABOR_RUBRO\s*=\s*["']([^"']+)["']/);
  const d2 = content.match(/(?:export\s+)?const\s+DEFAULT_NON_LABOR_RUBRO\s*=\s*["']([^"']+)["']/);
  if (d1) result.defaults.DEFAULT_LABOR_RUBRO = d1[1];
  if (d2) result.defaults.DEFAULT_NON_LABOR_RUBRO = d2[1];
  return result;
}

async function scanDynamo() {
  const client = new DynamoDBClient({ region: REGION });
  const items = [];
  let ExclusiveStartKey;
  do {
    const out = await client.send(new ScanCommand({ TableName: TABLE, Limit: 1000, ExclusiveStartKey }));
    if (out.Items) items.push(...out.Items.map(i => unmarshall(i)));
    ExclusiveStartKey = out.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

function indexByLinea(items) {
  const map = {};
  for (const it of items) {
    // Extract linea_codigo from sk (format: RUBRO#<linea_codigo>)
    let linea = it.linea_codigo || it.lineaCodigo || null;
    if (!linea && it.sk && typeof it.sk === 'string' && it.sk.startsWith('RUBRO#')) {
      linea = it.sk.substring(6); // Extract after 'RUBRO#'
    }
    if (!linea) continue;
    if (!map[linea]) map[linea] = [];
    map[linea].push(it);
  }
  return map;
}

(async () => {
  try {
    const fpath = path.resolve(__dirname, '..', 'src', 'lib', 'rubros', 'canonical-taxonomy.ts');
    const bpath = path.resolve(__dirname, '..', 'services', 'finanzas-api', 'src', 'lib', 'rubros-taxonomy.ts');
    if (!fs.existsSync(fpath)) throw new Error('Frontend canonical not found: ' + fpath);
    if (!fs.existsSync(bpath)) throw new Error('Backend rubros taxonomy not found: ' + bpath);
    const fcontent = fs.readFileSync(fpath, 'utf8');
    const bcontent = fs.readFileSync(bpath, 'utf8');
    const frontend = parseFrontendCanonical(fcontent);
    const backend = parseBackendRubrosTaxonomy(bcontent);
    const frontendIds = Object.keys(frontend);
    const backendIds = new Set([...Object.values(backend.roleToLinea), ...Object.values(backend.nonLabor)]);
    if (backend.defaults.DEFAULT_LABOR_RUBRO) backendIds.add(backend.defaults.DEFAULT_LABOR_RUBRO);
    if (backend.defaults.DEFAULT_NON_LABOR_RUBRO) backendIds.add(backend.defaults.DEFAULT_NON_LABOR_RUBRO);
    // Dynamo
    console.log('Scanning Dynamo table', TABLE);
    const items = await scanDynamo();
    const index = indexByLinea(items);
    const tableLineaKeys = Object.keys(index);
    const missingInDynamo = frontendIds.filter(id => !tableLineaKeys.includes(id));
    const extraInDynamo = tableLineaKeys.filter(k => !frontendIds.includes(k));
    const backendMissingFrontend = [...backendIds].filter(id => !frontendIds.includes(id));
    const frontendMissingBackend = frontendIds.filter(id => !backendIds.has(id));
    const attributeMismatches = {};
    for (const id of frontendIds) {
      if (!index[id]) continue;
      const f = frontend[id];
      for (const sample of index[id].slice(0, 3)) {
        const diffs = [];
        const tableDescr = ((sample.descripcion || sample.linea_gasto) || '').trim();
        const frontDescr = ((f.descripcion || f.linea_gasto) || '').trim();
        if (frontDescr && tableDescr && frontDescr !== tableDescr) diffs.push({ attr: 'descripcion/linea_gasto', frontend: frontDescr, table: tableDescr });
        else if (frontDescr && !tableDescr) diffs.push({ attr: 'descripcion/linea_gasto', frontend: frontDescr, table: null });
        const tableCatCode = (sample.categoria_codigo || sample.categoriaCode || '').trim();
        const frontCatCode = (f.categoria_codigo || '').trim();
        if (frontCatCode && tableCatCode && frontCatCode !== tableCatCode) diffs.push({ attr: 'categoria_codigo', frontend: frontCatCode, table: tableCatCode });
        else if (frontCatCode && !tableCatCode) diffs.push({ attr: 'categoria_codigo', frontend: frontCatCode, table: null });
        const tableCat = (sample.categoria || '').trim();
        const frontCat = (f.categoria || '').trim();
        if (frontCat && tableCat && frontCat !== tableCat) diffs.push({ attr: 'categoria', frontend: frontCat, table: tableCat });
        else if (frontCat && !tableCat) diffs.push({ attr: 'categoria', frontend: frontCat, table: null });
        const tableFuente = (sample.fuente_referencia || sample.fuente || '').trim();
        if ((f.fuente_referencia || '').trim() && tableFuente && f.fuente_referencia !== tableFuente) diffs.push({ attr: 'fuente_referencia', frontend: f.fuente_referencia, table: tableFuente });
        else if ((f.fuente_referencia || '').trim() && !tableFuente) diffs.push({ attr: 'fuente_referencia', frontend: f.fuente_referencia, table: null });
        const pk = sample.pk || null;
        const sk = sample.sk || null;
        if (pk && String(pk) !== 'TAXONOMY') diffs.push({ attr: 'pk', note: `pk is "${pk}" but expected TAXONOMY` });
        if (sk && String(sk) !== `RUBRO#${id}`) diffs.push({ attr: 'sk', note: `sk is "${sk}" but expected RUBRO#${id}` });
        if (diffs.length) {
          if (!attributeMismatches[id]) attributeMismatches[id] = [];
          attributeMismatches[id].push({ sampleKey: `${sample.pk || 'nopk'}|${sample.sk || 'nosk'}`, diffs, sample });
        }
      }
    }
    const report = { meta: { region: REGION, table: TABLE, scannedItems: items.length, frontendCount: frontendIds.length, backendDerivedCount: backendIds.size }, missingInDynamo, extraInDynamo, backendMissingFrontend, frontendMissingBackend, attributeMismatches, samples: { frontendSample: Object.entries(frontend).slice(0, 5), tableSamples: items.slice(0, 5) } };
    const outdir = path.resolve(__dirname, '..', 'tmp'); if (!fs.existsSync(outdir)) fs.mkdirSync(outdir);
    const outpath = path.resolve(outdir, 'taxonomy_report_full.json'); fs.writeFileSync(outpath, JSON.stringify(report, null, 2), 'utf8');
    console.log('WROTE', outpath);
    process.exit(0);
  } catch (err) {
    console.error('FAILED', err); process.exit(2);
  }
})();
