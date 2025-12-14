import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { defaultCorsHeaders } from "../lib/http";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  return {
    statusCode: 204,
    headers: defaultCorsHeaders(event),
    body: "",
  };
};
