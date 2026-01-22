#!/usr/bin/env node
// scripts/remediate-taxonomy-dynamo.cjs
// Usage:
// AWS_REGION=us-east-2 TAXONOMY_TABLE=finz_rubros_taxonomia node scripts/remediate-taxonomy-dynamo.cjs tmp/taxonomy_report_full.json
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { DynamoDBClient, GetItemCommand, PutItemCommand, DeleteItemCommand, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');

const REGION = process.env.AWS_REGION || 'us-east-2';
const TABLE = process.env.TAXONOMY_TABLE || 'finz_rubros_taxonomia';

function ask(q){ const rl = readline.createInterface({input: process.stdin, output: process.stdout}); return new Promise(r=>rl.question(q,a=>{rl.close();r(a);})); }

async function backupItem(client, pk, sk){
  const get = new GetItemCommand({ TableName: TABLE, Key: marshall({pk, sk})});
  const res = await client.send(get);
  const folder = path.resolve(__dirname,'..','tmp','backups');
  if(!fs.existsSync(folder)) fs.mkdirSync(folder,{recursive:true});
  const fname = `${folder}/backup_${pk.replace(/#/g,'-')}_${sk.replace(/#/g,'-')}.json`;
  fs.writeFileSync(fname, JSON.stringify(res.Item?unmarshall(res.Item):null,null,2),'utf8');
  return fname;
}

(async()=>{
  try{
    if(process.argv.length<3) { console.error('Usage: node scripts/remediate-taxonomy-dynamo.cjs tmp/taxonomy_report_full.json'); process.exit(1); }
    const reportPath = process.argv[2];
    if(!fs.existsSync(reportPath)) { console.error('Report not found',reportPath); process.exit(1); }
    const report = JSON.parse(fs.readFileSync(reportPath,'utf8'));
    const client = new DynamoDBClient({ region: REGION });
    const log = [];
    // 1) PK mismatches
    console.log('PK mismatches to consider (priority 1):');
    for(const [id, entries] of Object.entries(report.attributeMismatches||{})){
      for(const ent of entries){
        const pkDiff = ent.diffs.find(d=>d.attr==='pk');
        if(!pkDiff) continue;
        console.log(`ID ${id} has pk mismatch: ${JSON.stringify(ent.diffs,null,2)}; sample: ${ent.sampleKey}`);
        const confirm = (await ask(`Fix PK for ${id} (copy->put->delete)? (y/N): `));
        if(confirm.toLowerCase()!=='y') continue;
        // backup old item(s) that have this id
        const sample = ent.sample;
        const oldPk = sample.pk; const oldSk = sample.sk;
        const bfile = await backupItem(client, oldPk, oldSk);
        log.push({action:'backup', pk:oldPk, sk:oldSk, backupFile:bfile});
        // prepare new item with pk LINEA#id
        const newItem = Object.assign({}, sample, { pk:`LINEA#${id}`, linea_codigo: id });
        // ensure sk exists
        if(!newItem.sk) newItem.sk = `CATEGORIA#${newItem.categoria_codigo||'MOD'}`;
        // put new item
        const put = new PutItemCommand({ TableName: TABLE, Item: marshall(newItem) });
        await client.send(put);
        log.push({action:'put', pk:newItem.pk, sk:newItem.sk});
        // delete old item
        const del = new DeleteItemCommand({ TableName: TABLE, Key: marshall({ pk: oldPk, sk: oldSk }) });
        await client.send(del);
        log.push({action:'delete', pk:oldPk, sk:oldSk});
        console.log(`Fixed pk for ${id}: created ${newItem.pk}|${newItem.sk}, deleted ${oldPk}|${oldSk}`);
      }
    }

    // 2) Missing in Dynamo: create minimal items
    if((report.missingInDynamo||[]).length){
      console.log('Missing canonical IDs to create (priority 2):', report.missingInDynamo.length);
      for(const id of report.missingInDynamo){
        const proceed = (await ask(`Create minimal item for ${id}? (y/N): `));
        if(proceed.toLowerCase()!=='y') continue;
        // find frontend sample in report.samples if exists
        const fsample = (report.samples && report.samples.frontendSample && report.samples.frontendSample.find(x=>x[0]===id));
        const fobj = fsample?fsample[1]:null;
        const item = {
          pk: `LINEA#${id}`,
          sk: `CATEGORIA#${(fobj&&fobj.categoria_codigo)||'MOD'}`,
          linea_codigo: id,
          linea_gasto: (fobj&&fobj.linea_gasto) || id,
          descripcion: (fobj&&fobj.descripcion) || (fobj&&fobj.linea_gasto) || id,
          categoria: (fobj&&fobj.categoria) || 'Mano de Obra Directa',
          categoria_codigo: (fobj&&fobj.categoria_codigo) || 'MOD',
          fuente_referencia: (fobj&&fobj.fuente_referencia) || 'MSP',
          tipo_ejecucion: (fobj&&fobj.tipo_ejecucion) || 'mensual',
          tipo_costo: (fobj&&fobj.tipo_costo) || 'OPEX',
          createdAt: (new Date()).toISOString()
        };
        const putCmd = new PutItemCommand({ TableName: TABLE, Item: marshall(item) });
        await client.send(putCmd);
        log.push({action:'put_missing', pk:item.pk, sk:item.sk});
        console.log('Created', item.pk, item.sk);
      }
    }

    // 3) Attribute mismatches (priority 3)
    for(const [id, arr] of Object.entries(report.attributeMismatches||{})){
      for(const ent of arr){
        // skip PK diffs (handled above)
        const diffs = (ent.diffs||[]).filter(d=>d.attr!=='pk');
        if(!diffs.length) continue;
        const sample = ent.sample;
        console.log(`Attribute mismatches for ${id} sample ${ent.sampleKey}:`, diffs);
        const proceed = (await ask(`Update attributes for ${id} on ${ent.sampleKey}? (y/N): `));
        if(proceed.toLowerCase()!=='y') continue;
        const key = { pk: sample.pk, sk: sample.sk };
        await backupItem(client, key.pk, key.sk);
        // build update expression
        const updates = [];
        const names = {};
        const values = {};
        let i=0;
        for(const d of diffs){
          i++;
          if(d.attr==='descripcion/linea_gasto'){
            const newVal = (report.samples && report.samples.frontendSample) ? (report.samples.frontendSample.find(x=>x[0]===id)||[null,null])[1].descripcion : null;
            if(newVal){
              updates.push(`#n${i} = :v${i}`);
              names[`#n${i}`]='descripcion';
              values[`:v${i}`] = { S: newVal };
            }
          } else if(d.attr==='categoria_codigo'){
            i++;
            updates.push(`#n${i} = :v${i}`);
            names[`#n${i}`]='categoria_codigo';
            values[`:v${i}`] = { S: (report.samples && report.samples.frontendSample.find(x=>x[0]===id)||[null,null])[1].categoria_codigo || 'MOD' };
          } else if(d.attr==='categoria'){
            i++;
            updates.push(`#n${i} = :v${i}`);
            names[`#n${i}`]='categoria';
            values[`:v${i}`] = { S: (report.samples && report.samples.frontendSample.find(x=>x[0]===id)||[null,null])[1].categoria || 'Mano de Obra Directa' };
          } else if(d.attr==='fuente_referencia'){
            i++;
            updates.push(`#n${i} = :v${i}`);
            names[`#n${i}`]='fuente_referencia';
            values[`:v${i}`] = { S: (report.samples && report.samples.frontendSample.find(x=>x[0]===id)||[null,null])[1].fuente_referencia || 'MSP' };
          }
        }
        if(updates.length===0) { console.log('No attribute updates constructed for', id); continue; }
        const updateExpr = 'SET ' + updates.join(', ');
        const updateCmd = new UpdateItemCommand({ TableName: TABLE, Key: marshall(key), UpdateExpression: updateExpr, ExpressionAttributeNames: names, ExpressionAttributeValues: values });
        await client.send(updateCmd);
        log.push({action:'update', pk:key.pk, sk:key.sk, updated: updates});
        console.log('Updated attributes for', key.pk, key.sk);
      }
    }

    // extras: list and log for review
    if((report.extraInDynamo||[]).length){
      console.log('\nExtra IDs in Dynamo not present in frontend:', report.extraInDynamo.length);
      console.log('First 50 extras:', report.extraInDynamo.slice(0,50));
      log.push({action:'extras_list', items: report.extraInDynamo});
    }

    // write remediation log
    const outdir = path.resolve(__dirname,'..','tmp'); if(!fs.existsSync(outdir)) fs.mkdirSync(outdir);
    const logpath = path.resolve(outdir,'remediation-log.json');
    fs.writeFileSync(logpath, JSON.stringify(log,null,2),'utf8');
    console.log('Remediation finished; log written to', logpath);
    process.exit(0);
  }catch(err){ console.error('Remediation failed', err); process.exit(2); }
})();
