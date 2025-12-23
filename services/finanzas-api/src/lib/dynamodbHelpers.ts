// services/finanzas-api/src/lib/dynamodbHelpers.ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchGetCommand } from "@aws-sdk/lib-dynamodb";

const ddbRaw = new DynamoDBClient({});
export const ddb = DynamoDBDocumentClient.from(ddbRaw);

/**
 * Batch-get existing items for a list of keys.
 * Using batch-get to avoid N queries for large item lists.
 * 
 * @param tableName - The DynamoDB table name
 * @param keys - Array of {pk, sk} keys to check
 * @returns Array of found items
 */
export async function batchGetExistingItems(
  tableName: string, 
  keys: { pk: string; sk: string }[]
): Promise<any[]> {
  if (keys.length === 0) {
    return [];
  }

  const maxBatch = 100;
  const found: any[] = [];
  
  for (let i = 0; i < keys.length; i += maxBatch) {
    const batchKeys = keys.slice(i, i + maxBatch);
    const requestItems: any = { [tableName]: { Keys: batchKeys } };
    
    let resp = await ddb.send(new BatchGetCommand({ RequestItems: requestItems }));
    
    if (resp.Responses && resp.Responses[tableName]) {
      found.push(...resp.Responses[tableName]);
    }
    
    // Retry unprocessed keys with backoff
    let attempts = 0;
    while (resp.UnprocessedKeys && Object.keys(resp.UnprocessedKeys).length && attempts < 5) {
      attempts++;
      await new Promise(r => setTimeout(r, 200 * attempts));
      resp = await ddb.send(new BatchGetCommand({ RequestItems: resp.UnprocessedKeys }));
      if (resp.Responses && resp.Responses[tableName]) {
        found.push(...resp.Responses[tableName]);
      }
    }
  }
  
  return found;
}
