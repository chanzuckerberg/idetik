# pydetik 

Python wrapper for Idetik with some associated tools.

## Serve data from s3

To serve some data from an AWS S3 bucket, provide the AWS profile and S3 bucket name: 

```shell
uv run s3serve --aws_profile "sci-data-staging" --s3_bucket "czi-dynamic-cell-atlas-staging"
```