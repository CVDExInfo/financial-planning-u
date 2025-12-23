// services/finanzas-api/src/lib/dynamodbHelpers.ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchGetCommand } from "@aws-sdk/lib-dynamodb";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

/**
 * Batch get existing rubros from DynamoDB using BatchGetItem.
 * Handles DynamoDB batch-get size limits (100 items per request) and retries on throttling.
 * 
 * @param tableName - The DynamoDB table name
 * @param keys - Array of {pk, sk} keys to check
 * @returns Array of found items
 */
export async function batchGetExistingRubros(
  tableName: string, 
  keys: { pk: string; sk: string }[]
): Promise<any[]> {
  if (keys.length === 0) {
    return [];
  }

  const maxBatch = 100;
  const results: any[] = [];
  
  for (let i = 0; i < keys.length; i += maxBatch) {
    const batchKeys = keys.slice(i, i + maxBatch);
    const requestItems = { [tableName]: { Keys: batchKeys } };
    
    let resp = await client.send(new BatchGetCommand({ RequestItems: requestItems }));
    
    if (resp.Responses && resp.Responses[tableName]) {
      results.push(...resp.Responses[tableName]);
    }
    
    // Handle UnprocessedKeys with simple exponential backoff
    let attempts = 0;
    const maxRetries = 3;
    
    while (resp.UnprocessedKeys && Object.keys(resp.UnprocessedKeys).length && attempts < maxRetries) {
      attempts++;
      await new Promise(r => setTimeout(r, 200 * attempts));
      
      const retryResp = await client.send(new BatchGetCommand({ 
        RequestItems: resp.UnprocessedKeys 
      }));
      
      if (retryResp.Responses && retryResp.Responses[tableName]) {
        results.push(...retryResp.Responses[tableName]);
      }
      
      resp.UnprocessedKeys = retryResp.UnprocessedKeys;
    }
  }
  
  return results;
}
