/**
 * Forecast handler - GET /plan/forecast
 * Returns forecast data for a project
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { ok, bad } from "../lib/http";

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    const projectId = event.queryStringParameters?.projectId;
    const monthsStr = event.queryStringParameters?.months;

    // Validate required parameters
    if (!projectId) {
      return bad("Missing required parameter: projectId");
    }

    const months = monthsStr ? parseInt(monthsStr, 10) : 12;

    if (isNaN(months) || months < 1 || months > 60) {
      return bad("Invalid months parameter. Must be between 1 and 60.");
    }

    // TODO: Query forecast data from DynamoDB
    // For now, return empty array with proper structure
    const forecastData = [];

    return ok({
      data: forecastData,
      projectId,
      months,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in forecast handler:", error);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin":
          process.env.ALLOWED_ORIGIN || "https://d7t9x3j66yd8k.cloudfront.net",
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      }),
    };
  }
};
