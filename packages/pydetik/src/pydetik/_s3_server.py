import argparse
import logging
import re
import shutil
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

import boto3
from botocore.exceptions import ClientError

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s :: %(levelname)s :: %(message)s"
)
logger = logging.getLogger(__name__)


class S3HTTPRequestHandler(SimpleHTTPRequestHandler):
    s3_client: Any 
    s3_bucket: str

    def __init__(self, *args, s3_client: Any, s3_bucket: str, **kwargs):
        self.s3_client = s3_client
        self.s3_bucket = s3_bucket
        super().__init__(*args, **kwargs)

    def _get_s3_key(self):
        """Returns the S3 object key derived from the request path."""
        # The path includes a leading slash, which we remove for the S3 key.
        return self.path.lstrip("/")

    def _send_cors_headers(self):
        """Sends headers to allow cross-origin requests."""
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Range")
        self.send_header(
            "Access-Control-Expose-Headers", "Content-Range, Content-Length"
        )

    def end_headers(self):
        self._send_cors_headers()
        super().end_headers()

    def do_OPTIONS(self):
        """Handle pre-flight CORS requests."""
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def do_HEAD(self):
        """Handle HEAD requests to get metadata like content length."""
        s3_key = self._get_s3_key()
        if not s3_key:
            self.send_error(HTTPStatus.BAD_REQUEST, "No S3 object key specified.")
            return

        try:
            head_object = self.s3_client.head_object(Bucket=self.s3_bucket, Key=s3_key)
            total_size = head_object["ContentLength"]
            content_type = head_object["ContentType"]

            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(total_size))
            self.send_header("Accept-Ranges", "bytes")
            self.end_headers()

        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code")
            if error_code == "404" or error_code == "NoSuchKey":
                self.send_error(HTTPStatus.NOT_FOUND, "Object not found")
            else:
                self.send_error(HTTPStatus.INTERNAL_SERVER_ERROR, "Error accessing S3")

    def do_GET(self):
        """Handle GET requests for S3 objects."""
        s3_key = self._get_s3_key()
        if not s3_key:
            logger.error(f"No S3 object key specified in the request path: {self.path}")
            self.send_error(HTTPStatus.BAD_REQUEST, "No S3 object key specified.")
            return

        try:
            # First, get object metadata to check for existence and get size.
            head_object = self.s3_client.head_object(Bucket=self.s3_bucket, Key=s3_key)
            total_size = head_object["ContentLength"]
            content_type = head_object["ContentType"]

            range_header = self.headers.get("Range")

            logger.info(f"Request for S3 object '{s3_key}' with Range: {range_header}")
            if range_header:
                self._handle_range_request(
                    s3_key, total_size, content_type, range_header
                )
            else:
                self._handle_full_request(s3_key, total_size, content_type)

        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code")
            if error_code == "404" or error_code == "NoSuchKey":
                logger.error(f"S3 object not found: {s3_key}")
                self.send_error(HTTPStatus.NOT_FOUND, "Object not found")
            else:
                logger.error(f"S3 ClientError for key '{s3_key}': {e}")
                self.send_error(HTTPStatus.INTERNAL_SERVER_ERROR, "Error accessing S3")
        except Exception as e:
            logger.error(f"An unexpected error occurred for key '{s3_key}': {e}")
            self.send_error(
                HTTPStatus.INTERNAL_SERVER_ERROR, "An internal error occurred"
            )

    def _handle_full_request(self, s3_key, total_size, content_type):
        """Serves the entire S3 object."""
        logger.info(f"Serving full object '{s3_key}' ({total_size} bytes)")

        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(total_size))
        self.send_header("Accept-Ranges", "bytes")
        self.end_headers()

        # Get the object and stream its content to the client
        s3_object = self.s3_client.get_object(Bucket=self.s3_bucket, Key=s3_key)
        shutil.copyfileobj(s3_object["Body"], self.wfile)

    def _handle_range_request(self, s3_key, total_size, content_type, range_header):
        """Parses the Range header and serves a partial S3 object."""
        match = re.search(r"bytes=(\d+)-(\d*)", range_header)
        if not match:
            logger.error(f"Invalid Range header: {range_header}")
            self.send_error(
                HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE, "Invalid Range header"
            )
            return

        start_str, end_str = match.groups()
        start = int(start_str)
        end = int(end_str) if end_str else total_size - 1
        # TODO: zarrita's range request can exceed the file size, so we clamp it.
        # This should probably be handled by the client/zarrita.
        end = min(end, total_size - 1)

        if start >= total_size or end >= total_size or start > end:
            logger.error(
                f"Requested range not satisfiable: {range_header} of {total_size} for object '{s3_key}'"
            )
            self.send_error(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
            return

        content_length = end - start + 1
        range_spec = f"bytes {start}-{end}/{total_size}"
        s3_range = f"bytes={start}-{end}"

        logger.info(f"Serving partial object '{s3_key}', range: {s3_range}")

        self.send_response(HTTPStatus.PARTIAL_CONTENT)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(content_length))
        self.send_header("Content-Range", range_spec)
        self.send_header("Accept-Ranges", "bytes")
        self.end_headers()

        # Get the specific byte range from S3 and stream it
        s3_object = self.s3_client.get_object(
            Bucket=self.s3_bucket, Key=s3_key, Range=s3_range
        )
        shutil.copyfileobj(s3_object["Body"], self.wfile)


class S3HTTPServer(ThreadingHTTPServer):
    """HTTP server that handles requests in separate threads."""

    s3_client: Any 
    aws_profile: str
    s3_bucket: str

    def __init__(
        self,
        *,
        host: str,
        port: int,
        aws_profile: str,
        s3_bucket: str,
    ) -> None:
        self.s3_bucket = s3_bucket
        self.aws_profile = aws_profile
        s3_client = get_s3_client(aws_profile)
        self.s3_client = s3_client

        class RequestHandler(S3HTTPRequestHandler):
            def __init__(self, *args, **kwargs):
                super().__init__(
                    *args, s3_client=s3_client, s3_bucket=s3_bucket, **kwargs
                )

        super().__init__((host, port), RequestHandler)


def get_s3_client(aws_profile: str):
    try:
        session = boto3.Session(profile_name=aws_profile)
        s3_client = session.client("s3")
        logger.info(f"Successfully connected to S3 using profile '{aws_profile}'.")
        return s3_client
    except Exception as e:
        raise Exception(
            f"Error setting up boto3 session: {e}\nPlease ensure your AWS profile is configured correctly."
        )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run HTTP server from S3 bucket with range request support"
    )
    parser.add_argument("--host", type=str, default="localhost", help="Host to bind to")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind to")
    parser.add_argument(
        "--aws_profile", type=str, required=True, help="AWS profile name"
    )
    parser.add_argument("--s3_bucket", type=str, required=True, help="S3 bucket name")
    args = parser.parse_args()

    server = S3HTTPServer(
        host=args.host,
        port=args.port,
        aws_profile=args.aws_profile,
        s3_bucket=args.s3_bucket,
    )

    logger.info(
        f"Serving objects from S3 bucket '{args.s3_bucket}' on 'http://{args.host}:{args.port}'"
    )
    logger.info("Press Ctrl+C to stop.")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("Server stopping.")
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
