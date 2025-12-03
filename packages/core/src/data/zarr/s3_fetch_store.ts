import FetchStore from "@zarrita/storage/fetch";

type AwsCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
};

export type S3FetchStoreProps = {
  url: string;
  region?: string;
  credentials?: AwsCredentials;
  /** RequestInit overrides to customize fetch behavior (e.g., custom headers for S3 authentication) */
  overrides?: RequestInit;
  /** Whether to use suffix requests for range queries */
  useSuffixRequest?: boolean;
};

/**
 * Checks if the current environment is safe for using S3FetchStore.
 * Only allows localhost, 127.0.0.1, 0.0.0.0, or any 127.x.x.x address.
 * @throws Error if not in a safe local environment
 */
function checkLocalOnlyEnvironment(): void {
  // Only check in browser environments
  if (typeof window === "undefined") {
    return;
  }

  const hostname = window.location.hostname;

  // Allow localhost variants
  const isLocalhost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname.startsWith("127."); // Any 127.x.x.x

  if (!isLocalhost) {
    const message =
      "S3FetchStore is only allowed in local development environments. ";
    throw new Error(message);
  }
}

/**
 * A FetchStore that generates AWS Signature V4 headers for each request.
 * This is necessary because AWS signatures are path-specific and expire quickly.
 *
 * SECURITY WARNING: This class is only intended for local development.
 * Credentials are passed to worker threads and stored in memory.
 * Do not use in production - implement a secure backend proxy instead.
 */
export class S3FetchStore extends FetchStore {
  public readonly credentials?: AwsCredentials;
  public readonly region?: string;
  // Cache signing keys per date/region combination (valid for 24 hours)
  private signingKeyCache_ = new Map<string, Uint8Array>();
  public readonly overrides?: RequestInit;
  public readonly useSuffixRequest?: boolean;

  constructor(props: S3FetchStoreProps) {
    // Safety check: only allow in local development environments
    checkLocalOnlyEnvironment();

    // Don't pass static headers to parent - we'll generate them per-request
    super(props.url, {
      overrides: props.overrides,
      useSuffixRequest: props.useSuffixRequest,
    });

    this.credentials = props.credentials;
    this.region = props.region;
    this.overrides = props.overrides;
    this.useSuffixRequest = props.useSuffixRequest;
  }

  /**
   * Override get() to generate fresh auth headers for each request
   */
  async get(
    key: `/${string}`,
    options?: RequestInit
  ): Promise<Uint8Array | undefined> {
    if (this.credentials && this.region) {
      // Generate fresh headers for this specific request
      // Remove trailing slash from url if present to avoid double slashes
      const baseUrl = this.url.toString().replace(/\/$/, "");
      const fullUrl = `${baseUrl}${key}`;
      const authHeaders = await this.generateAuthHeaders(fullUrl, "GET");

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
   * Override getRange() to generate fresh auth headers for range requests
   * This handles HEAD requests made by fetch_suffix
   */
  async getRange(
    key: `/${string}`,
    range: { offset: number; length: number } | { suffixLength: number },
    options?: RequestInit
  ): Promise<Uint8Array | undefined> {
    if (this.credentials && this.region) {
      const baseUrl = this.url.toString().replace(/\/$/, "");
      const fullUrl = `${baseUrl}${key}`;

      // Generate auth headers for HEAD request (used by fetch_suffix to get Content-Length)
      const headAuthHeaders = await this.generateAuthHeaders(fullUrl, "HEAD");

      // Generate auth headers for GET request (used for actual range fetch)
      const getAuthHeaders = await this.generateAuthHeaders(fullUrl, "GET");

      // Create a custom fetch wrapper that applies the right headers for each method
      const originalFetch = globalThis.fetch;
      const authenticatedFetch = async (
        input: RequestInfo | URL,
        init?: RequestInit
      ) => {
        const method = init?.method || "GET";
        const authHeaders =
          method === "HEAD" ? headAuthHeaders : getAuthHeaders;

        const mergedInit = {
          ...init,
          headers: {
            ...init?.headers,
            ...authHeaders,
          },
        };

        return originalFetch(input, mergedInit);
      };

      // Temporarily replace fetch for this call
      const originalGlobalFetch = globalThis.fetch;
      globalThis.fetch = authenticatedFetch as typeof fetch;

      try {
        return await super.getRange(key, range, options);
      } finally {
        // Restore original fetch
        globalThis.fetch = originalGlobalFetch;
      }
    }

    return super.getRange(key, range, options);
  }

  /**
   * Generate AWS Signature V4 headers for a specific URL and HTTP method
   * This uses the Web Crypto API for browser compatibility
   */
  private async generateAuthHeaders(
    url: string,
    method: string = "GET"
  ): Promise<Record<string, string>> {
    if (!this.credentials || !this.region) {
      return {};
    }

    const { accessKeyId, secretAccessKey, sessionToken } = this.credentials;
    const region = this.region;
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

    const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQuerystring}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

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

  /**
   * Get the signing key for a given date/region combination.
   * Caches the key to avoid regenerating it for every request (key is valid for 24 hours).
   */
  private async getSignatureKey(
    key: string,
    dateStamp: string,
    region: string,
    service: string
  ): Promise<Uint8Array> {
    // Cache key: dateStamp + region (credentials are per-instance, so we don't need to include them)
    const cacheKey = `${dateStamp}-${region}`;

    // Check cache first
    const cached = this.signingKeyCache_.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Generate signing key (4 sequential HMAC operations)
    const kDate = await this.hmacSha256Bytes("AWS4" + key, dateStamp);
    const kRegion = await this.hmacSha256Bytes(kDate, region);
    const kService = await this.hmacSha256Bytes(kRegion, service);
    const kSigning = await this.hmacSha256Bytes(kService, "aws4_request");

    // Cache the result (valid for 24 hours until dateStamp changes)
    this.signingKeyCache_.set(cacheKey, kSigning);

    return kSigning;
  }

  private bufferToHex(buffer: Uint8Array): string {
    return Array.from(buffer)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
}
