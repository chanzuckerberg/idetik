/**
 * AWS Signature V4 authentication for S3
 *
 * This module generates AWS authentication headers for accessing private S3 data.
 * Note: In production, credentials should come from a secure backend, not hardcoded.
 */

export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

export interface S3Config {
  region: string;
  service: string;
}

function getAmzDate(): string {
  return new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function getDateStamp(amzDate: string): string {
  return amzDate.slice(0, 8);
}

async function sign(key: Uint8Array | string, msg: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const keyData = typeof key === 'string' ? encoder.encode(key) : key;
  const msgData = encoder.encode(msg);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  return new Uint8Array(signature);
}

async function getSignatureKey(
  key: string,
  dateStamp: string,
  region: string,
  service: string
): Promise<Uint8Array> {
  const kDate = await sign('AWS4' + key, dateStamp);
  const kRegion = await sign(kDate, region);
  const kService = await sign(kRegion, service);
  const kSigning = await sign(kService, 'aws4_request');
  return kSigning;
}

function bufferToHex(buffer: Uint8Array): string {
  return Array.from(buffer)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function generateAwsAuthHeaders(
  method: string,
  url: string,
  credentials: AwsCredentials,
  config: S3Config
): Promise<Record<string, string>> {
  const amzDate = getAmzDate();
  const dateStamp = getDateStamp(amzDate);

  const urlObj = new URL(url);
  const host = urlObj.host;
  const canonicalUri = urlObj.pathname;
  const canonicalQuerystring = urlObj.search.slice(1);

  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:UNSIGNED-PAYLOAD\n` +
    `x-amz-date:${amzDate}\n` +
    (credentials.sessionToken ? `x-amz-security-token:${credentials.sessionToken}\n` : '');

  const signedHeaders = credentials.sessionToken
    ? 'host;x-amz-content-sha256;x-amz-date;x-amz-security-token'
    : 'host;x-amz-content-sha256;x-amz-date';

  const payloadHash = 'UNSIGNED-PAYLOAD';

  const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQuerystring}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${config.region}/${config.service}/aws4_request`;

  // Hash canonical request
  const encoder = new TextEncoder();
  const canonicalRequestHash = await crypto.subtle.digest('SHA-256', encoder.encode(canonicalRequest));
  const canonicalRequestHashHex = bufferToHex(new Uint8Array(canonicalRequestHash));

  const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${canonicalRequestHashHex}`;

  const signingKey = await getSignatureKey(
    credentials.secretAccessKey,
    dateStamp,
    config.region,
    config.service
  );

  const signatureBytes = await sign(signingKey, stringToSign);
  const signature = bufferToHex(signatureBytes);

  const authorizationHeader = `${algorithm} Credential=${credentials.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const headers: Record<string, string> = {
    Authorization: authorizationHeader,
    'X-Amz-Date': amzDate,
    'X-Amz-Content-Sha256': payloadHash,
  };

  if (credentials.sessionToken) {
    headers['X-Amz-Security-Token'] = credentials.sessionToken;
  }

  return headers;
}
