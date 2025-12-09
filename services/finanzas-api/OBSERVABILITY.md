# Finanzas SD API - Observability Guide

## Overview

The Finanzas SD API includes comprehensive observability features to monitor application health, performance, and errors.

## CloudWatch Alarms

### Configuration

CloudWatch alarms are **optional** and configured via the `AlarmEmail` parameter. When provided, the stack creates:

1. **SNS Topic** for alarm notifications
2. **CloudWatch Alarms** for critical metrics
3. **Email subscription** to the SNS topic

### Enabling Alarms

To enable alarms during deployment, set the `AlarmEmail` parameter:

```bash
sam deploy \
  --config-env dev \
  --region us-east-2 \
  --parameter-overrides \
    AlarmEmail=ops-team@example.com
```

Or update `samconfig.toml`:

```toml
[dev.deploy.parameters]
parameter_overrides = [
  "AlarmEmail=ops-team@example.com"
]
```

### Configured Alarms

#### 1. API 5xx Error Alarm
- **Metric**: `AWS/ApiGateway` `5XXError`
- **Threshold**: > 10 errors in 5 minutes
- **Evaluation**: 1 period
- **Purpose**: Detect server-side errors (Lambda failures, timeouts, etc.)

**When it triggers:**
- Lambda function crashes
- Unhandled exceptions
- API Gateway integration errors
- Backend service unavailability

#### 2. API 4xx Error Alarm
- **Metric**: `AWS/ApiGateway` `4XXError`
- **Threshold**: > 100 errors in 5 minutes
- **Evaluation**: 2 consecutive periods (10 minutes)
- **Purpose**: Detect excessive client errors (authentication, validation, not found)

**When it triggers:**
- Authentication/authorization failures spike
- Invalid request patterns
- Missing required parameters
- Client integration issues

#### 3. API Latency Alarm
- **Metric**: `AWS/ApiGateway` `Latency`
- **Threshold**: > 3000ms average
- **Evaluation**: 2 consecutive periods (10 minutes)
- **Purpose**: Detect performance degradation

**When it triggers:**
- Database query slowdowns
- Lambda cold starts
- External service latency
- CPU/memory constraints

### Alarm Actions

When an alarm triggers:
1. SNS notification sent to configured email
2. Email includes:
   - Alarm name and description
   - Current metric value
   - Threshold breached
   - Link to CloudWatch dashboard

### Disabling Alarms

To disable alarms without deleting the stack:

1. Remove or set `AlarmEmail` to empty string:
   ```bash
   sam deploy --config-env dev --region us-east-2 --parameter-overrides AlarmEmail=''
   ```

2. Alarms and SNS topic will be removed on next deployment

## CloudWatch Logs

### Access Logs

API Gateway access logs are enabled by default:

- **Log Group**: `/aws/http-api/{StageName}/finz-access`
- **Retention**: 14 days
- **Format**: JSON with request/response details

**Querying Access Logs:**

```bash
# Get recent 5xx errors
aws logs filter-log-events \
  --log-group-name /aws/http-api/dev/finz-access \
  --filter-pattern '{ $.status >= 500 }' \
  --start-time $(date -u -d '1 hour ago' +%s)000

# Get slow requests (> 1s)
aws logs filter-log-events \
  --log-group-name /aws/http-api/dev/finz-access \
  --filter-pattern '{ $.responseLatency > 1000 }'
```

### Lambda Function Logs

Each Lambda function writes to its own CloudWatch log group:

- **Log Group Pattern**: `/aws/lambda/{FunctionName}`
- **Retention**: 14 days (configurable)

**Querying Lambda Logs:**

```bash
# Get errors from ProjectsFn
aws logs filter-log-events \
  --log-group-name /aws/lambda/finanzas-sd-api-dev-ProjectsFn-{id} \
  --filter-pattern ERROR

# Get warnings
aws logs filter-log-events \
  --log-group-name /aws/lambda/finanzas-sd-api-dev-ProjectsFn-{id} \
  --filter-pattern WARN
```

## X-Ray Tracing

X-Ray tracing is **enabled globally** on all Lambda functions via:

```yaml
Globals:
  Function:
    Tracing: Active
```

### Viewing Traces

1. Open [AWS X-Ray Console](https://console.aws.amazon.com/xray)
2. Select region: **us-east-2**
3. View:
   - **Service Map**: Visual representation of API calls
   - **Traces**: Individual request traces with timing breakdown
   - **Analytics**: Query traces by response time, errors, etc.

### X-Ray Insights

X-Ray automatically captures:
- Request/response times
- DynamoDB query performance
- External HTTP calls
- Lambda cold/warm starts
- Errors and exceptions

**Example Trace Analysis:**
```
Request → API Gateway (5ms)
  → Lambda (ProjectsFn) (250ms)
    → DynamoDB GetItem (45ms)
    → DynamoDB Query (120ms)
  → Response
```

## CloudWatch Dashboards

### Creating a Custom Dashboard

```bash
aws cloudwatch put-dashboard --dashboard-name finanzas-api-dev \
  --dashboard-body file://dashboard.json
```

**Example Dashboard JSON:**

```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/ApiGateway", "5XXError", {"stat": "Sum"}],
          [".", "4XXError", {"stat": "Sum"}]
        ],
        "period": 300,
        "stat": "Sum",
        "region": "us-east-2",
        "title": "API Errors"
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/ApiGateway", "Latency", {"stat": "Average"}]
        ],
        "period": 300,
        "stat": "Average",
        "region": "us-east-2",
        "title": "API Latency"
      }
    }
  ]
}
```

## Metrics to Monitor

### API Gateway Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| **Count** | Total requests | Monitor trends |
| **4XXError** | Client errors | < 5% of total |
| **5XXError** | Server errors | < 0.1% of total |
| **Latency** | Response time | p99 < 2s |
| **IntegrationLatency** | Backend time | p99 < 1.5s |

### Lambda Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| **Invocations** | Function calls | Monitor trends |
| **Errors** | Function failures | < 0.1% |
| **Throttles** | Concurrent limit | 0 |
| **Duration** | Execution time | p99 < 10s |
| **ConcurrentExecutions** | Active functions | < reserved limit |

### DynamoDB Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| **UserErrors** | Client errors (400s) | 0 |
| **SystemErrors** | Service errors | 0 |
| **ThrottledRequests** | Rate limiting | 0 |
| **ConsumedReadCapacityUnits** | Read usage | Monitor trends |
| **ConsumedWriteCapacityUnits** | Write usage | Monitor trends |

## Alerting Best Practices

### 1. Start with Conservative Thresholds
- 5xx: > 10 in 5 minutes (avoid false positives from transient errors)
- 4xx: > 100 in 10 minutes (normal client errors shouldn't trigger)
- Latency: > 3000ms average (allow for cold starts)

### 2. Adjust Based on Traffic Patterns
- Review alarm history after 1 week
- Increase thresholds if false positives occur
- Decrease if real issues are missed

### 3. Use Composite Alarms for Noisy Metrics
For environments with high variability, create composite alarms:

```yaml
CompositeAlarm:
  Type: AWS::CloudWatch::CompositeAlarm
  Properties:
    AlarmName: finanzas-api-critical-issues
    AlarmRule: (ALARM(Api5xxErrorAlarm) OR ALARM(ApiLatencyAlarm))
```

### 4. Set Up Escalation
- **Email**: Immediate notification
- **PagerDuty/OpsGenie**: After 15 minutes unresolved
- **Slack/Teams**: All alarms for awareness

## Incident Response Workflow

### When an Alarm Triggers

1. **Acknowledge** the alarm in SNS/email
2. **Check CloudWatch Logs**:
   ```bash
   # View recent errors
   aws logs tail /aws/http-api/dev/finz-access --follow --filter-pattern ERROR
   ```
3. **Review X-Ray Traces**: Identify slow/failing requests
4. **Check Lambda Logs**: Look for exceptions, timeouts
5. **Verify DynamoDB**: Check for throttling, high latency
6. **Inspect Recent Deployments**: Did a deploy trigger the issue?

### Common Issues & Solutions

#### 5xx Spike
- **Cause**: Lambda errors, timeouts, or memory issues
- **Fix**: Check Lambda logs, increase memory/timeout if needed
- **Rollback**: Revert to previous Lambda version if recent deploy

#### High Latency
- **Cause**: DynamoDB slow queries, cold starts, external API delays
- **Fix**: Optimize queries, increase provisioned concurrency, cache responses
- **Temporary**: Increase Lambda memory for better CPU

#### 4xx Spike
- **Cause**: Client integration change, auth issues, breaking API change
- **Fix**: Review recent client deploys, check Cognito configuration
- **Communicate**: Notify client teams of required changes

## Continuous Monitoring

### Weekly Review
- [ ] Check alarm history (any false positives?)
- [ ] Review error logs (any patterns?)
- [ ] Analyze latency trends (degrading?)
- [ ] Verify cost vs. budget

### Monthly Review
- [ ] Adjust alarm thresholds if needed
- [ ] Archive old logs to S3 (if needed)
- [ ] Review X-Ray service map for bottlenecks
- [ ] Update dashboards with new metrics

### Quarterly Review
- [ ] Audit log retention policies
- [ ] Review and optimize DynamoDB indexes
- [ ] Evaluate Lambda memory/timeout settings
- [ ] Update observability documentation

## Resources

- [API Gateway Metrics](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-metrics.html)
- [Lambda Metrics](https://docs.aws.amazon.com/lambda/latest/dg/monitoring-metrics.html)
- [DynamoDB Metrics](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/metrics-dimensions.html)
- [X-Ray Documentation](https://docs.aws.amazon.com/xray/latest/devguide/xray-console.html)
- [CloudWatch Alarms](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html)
