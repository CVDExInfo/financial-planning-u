// services/finanzas-api/src/lib/queue.ts
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const sqs = new SQSClient({ region: process.env.AWS_REGION });

export async function enqueueMaterialization(baselineId: string, projectId?: string) {
  const QueueUrl = process.env.MATERIALIZE_QUEUE_URL!;
  if (!QueueUrl) {
    throw new Error("MATERIALIZE_QUEUE_URL not set");
  }
  const payload = { baselineId, projectId, requestedAt: new Date().toISOString() };
  await sqs.send(new SendMessageCommand({
    QueueUrl,
    MessageBody: JSON.stringify(payload),
    MessageAttributes: {
      'event': { StringValue: 'materialize_baseline', DataType: 'String' }
    }
  }));
}
