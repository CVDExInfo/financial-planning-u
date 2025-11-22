import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

export interface OAuthSecret {
  client_id: string;
  client_secret: string;
  base_url: string;
}

export interface ODataSecret {
  username: string;
  password: string;
  odata_url: string;
}

const defaultClient = new SecretsManagerClient({});

export async function getSecretJson<T>(secretId: string, client: SecretsManagerClient = defaultClient): Promise<T> {
  const command = new GetSecretValueCommand({ SecretId: secretId });
  const response = await client.send(command);
  if (!response.SecretString) {
    throw new Error(`Secret ${secretId} has no string value`);
  }
  return JSON.parse(response.SecretString) as T;
}
