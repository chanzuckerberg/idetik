import FetchStore from "@zarrita/storage/fetch";
import type { FetchOptions } from "../ome_zarr/image_source";

export type AwsCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
};

export type AuthenticatedFetchOptions = FetchOptions & {
  credentials?: AwsCredentials;
  region?: string;
};

/**
 * A FetchStore that generates AWS Signature V4 headers for each request.
 * This is necessary because AWS signatures are path-specific and expire quickly.
 */
export class AuthenticatedFetchStore extends FetchStore {
  private credentials_?: AwsCredentials;
  private region_?: string;

  constructor(url: string, options?: AuthenticatedFetchOptions) {
    // Don't pass static headers to parent - we'll generate them per-request
    const { credentials, region, ...fetchOptions } = options || {};
    super(url, fetchOptions);

    this.credentials_ = credentials;
    this.region_ = region;
  }

  public get credentials(): AwsCredentials | undefined {
    return this.credentials_;
  }

  public get region(): string | undefined {
    return this.region_;
  }

  /**
   * Override get() to generate fresh auth headers for each request
   */
  async get(
    key: `/${string}`,
    options?: RequestInit
  ): Promise<Uint8Array | undefined> {
    if (this.credentials_ && this.region_) {
      // Generate fresh headers for this specific request
      // Remove trailing slash from url if present to avoid double slashes
      const baseUrl = this.url.toString().replace(/\/$/, "");
      const fullUrl = `${baseUrl}${key}`;
      const authHeaders = await this.generateAuthHeaders(fullUrl);

      // Merge with any existing headers
      const mergedOptions = {
        ...options,
        headers: {
          ...options?.headers,
          ...authHeaders,
        },
      };

      return super.get(key, mergedOptions);
    }

    return super.get(key, options);
  }

  /**
   * Generate AWS Signature V4 headers for a specific URL
   * This uses the Web Crypto API for browser compatibility
   */
  private async generateAuthHeaders(
    url: string
  ): Promise<Record<string, string>> {
    if (!this.credentials_ || !this.region_) {
      return {};
    }

    const { accessKeyId, secretAccessKey, sessionToken } = this.credentials_;
    const region = this.region_;
    const service = "s3"; // Always S3 for this implementation

    const amzDate = this.getAmzDate();
    const dateStamp = amzDate.slice(0, 8);

    const urlObj = new URL(url);
    const host = urlObj.host;
    const canonicalUri = urlObj.pathname;
    const canonicalQuerystring = urlObj.search.slice(1);

    const canonicalHeaders =
      `host:${host}\n` +
      `x-amz-content-sha256:UNSIGNED-PAYLOAD\n` +
      `x-amz-date:${amzDate}\n` +
      (sessionToken ? `x-amz-security-token:${sessionToken}\n` : "");

    const signedHeaders = sessionToken
      ? "host;x-amz-content-sha256;x-amz-date;x-amz-security-token"
      : "host;x-amz-content-sha256;x-amz-date";

    const payloadHash = "UNSIGNED-PAYLOAD";

    const canonicalRequest = `GET\n${canonicalUri}\n${canonicalQuerystring}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

    const algorithm = "AWS4-HMAC-SHA256";
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

    // Hash canonical request
    const canonicalRequestHash = await this.sha256(canonicalRequest);

    const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${canonicalRequestHash}`;

    // Generate signing key
    const signingKey = await this.getSignatureKey(
      secretAccessKey,
      dateStamp,
      region,
      service
    );

    // Generate signature
    const signature = await this.hmacSha256(signingKey, stringToSign);

    const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const headers: Record<string, string> = {
      Authorization: authorizationHeader,
      "X-Amz-Date": amzDate,
      "X-Amz-Content-Sha256": payloadHash,
    };

    if (sessionToken) {
      headers["X-Amz-Security-Token"] = sessionToken;
    }

    return headers;
  }

  private getAmzDate(): string {
    return new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  }

  private async sha256(message: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return this.bufferToHex(new Uint8Array(hashBuffer));
  }

  private async hmacSha256(key: Uint8Array, message: string): Promise<string> {
    const encoder = new TextEncoder();
    const msgData = encoder.encode(message);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
    return this.bufferToHex(new Uint8Array(signature));
  }

  private async hmacSha256Bytes(
    key: Uint8Array | string,
    message: string
  ): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const keyData = typeof key === "string" ? encoder.encode(key) : key;
    const msgData = encoder.encode(message);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
    return new Uint8Array(signature);
  }

  private async getSignatureKey(
    key: string,
    dateStamp: string,
    region: string,
    service: string
  ): Promise<Uint8Array> {
    const kDate = await this.hmacSha256Bytes("AWS4" + key, dateStamp);
    const kRegion = await this.hmacSha256Bytes(kDate, region);
    const kService = await this.hmacSha256Bytes(kRegion, service);
    const kSigning = await this.hmacSha256Bytes(kService, "aws4_request");
    return kSigning;
  }

  private bufferToHex(buffer: Uint8Array): string {
    return Array.from(buffer)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
}

/**
 * Creates an appropriate FetchStore based on whether authentication credentials are provided.
 * Returns AuthenticatedFetchStore if credentials and region are present, otherwise returns FetchStore.
 */
export function createFetchStore(
  url: string,
  options?: AuthenticatedFetchOptions
): FetchStore | AuthenticatedFetchStore {
  return options?.credentials && options?.region
    ? new AuthenticatedFetchStore(url, options)
    : new FetchStore(url, options);
}
