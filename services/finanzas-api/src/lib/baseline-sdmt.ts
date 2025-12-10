import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tableName } from "./dynamo";

export interface ProjectBaselineInfo {
  baselineId: string | null;
  baselineStatus: string | null;
}

/**
 * Fetch the active baseline for a project from the shared baselines table.
 *
 * This helper intentionally relies on the DynamoDBDocumentClient exported from
 * lib/dynamo so that Jest mocks that module in unit tests. Using the command
 * directly from @aws-sdk/lib-dynamodb avoids runtime errors like
 * "GetCommand is not a constructor" that can occur when attempting to read the
 * command off a mocked Dynamo client.
 */
export async function getProjectActiveBaseline(
  projectId: string
): Promise<ProjectBaselineInfo> {
  try {
    const response = await ddb.send(
      new GetCommand({
        TableName: tableName("projects"),
        Key: {
          pk: `PROJECT#${projectId}`,
          sk: "BASELINE#ACTIVE",
        },
      })
    );

    const baselineId = (response.Item as any)?.baseline_id || null;
    const baselineStatus = (response.Item as any)?.baseline_status || null;

    return { baselineId, baselineStatus };
  } catch (error) {
    console.error("Error fetching project baseline", { projectId, error });
    return { baselineId: null, baselineStatus: null };
  }
}

export default getProjectActiveBaseline;
