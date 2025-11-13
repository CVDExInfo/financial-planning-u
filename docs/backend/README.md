# Finanzas API Backend Documentation

This directory contains technical documentation for the Finanzas Service Delivery API backend.

## Documentation Index

- **[Deployment Guide](./deployment.md)** - How the API is deployed and configured

## Quick Reference

### Current Environment

- **Stack**: `finanzas-sd-api-dev`
- **Stage**: `dev`
- **API ID**: `m3g6am67aj`
- **Region**: `us-east-2`
- **Base URL**: `https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev`

### Key Characteristics

- Single environment deployment (pilot phase)
- AWS SAM-based infrastructure
- DynamoDB for data storage (tables prefixed with `finz_`)
- Cognito JWT authentication
- HTTP API (API Gateway v2)

## Getting Started

For deployment information, see [Deployment Guide](./deployment.md).

## Architecture

The Finanzas API follows a serverless architecture:

```
┌─────────────┐       ┌──────────────────┐       ┌──────────────┐
│  CloudFront │ ────> │   API Gateway    │ ────> │   Lambda     │
│             │       │   (HTTP API)     │       │  Functions   │
└─────────────┘       └──────────────────┘       └──────────────┘
                              │                          │
                              │                          ▼
                              │                   ┌──────────────┐
                              │                   │   DynamoDB   │
                              │                   │    Tables    │
                              │                   └──────────────┘
                              ▼
                       ┌──────────────┐
                       │   Cognito    │
                       │  User Pool   │
                       └──────────────┘
```

## Contributing

When updating backend documentation:
1. Keep documentation in sync with code changes
2. Update this README when adding new documentation files
3. Use clear, concise language
4. Include code examples where helpful
