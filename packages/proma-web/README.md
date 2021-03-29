# proma-web

The idea is to have the public/deployed function served via proma.app and all the
developmnet happening in proma.dev

## Setup S3 local

```
aws configure --profile s3local
# AWS Access Key ID [None]: S3RVER
# AWS Secret Access Key [None]: S3RVER
```

```
aws --endpoint http://localhost:4569 --profile s3local s3 cp <local_file> s3://<bucket>/<key>
```

```
aws --endpoint http://localhost:4569 --profile s3local s3 cp seeds/greet.json s3://dev-proma-projects-data/nikso/default/greet.json
```
