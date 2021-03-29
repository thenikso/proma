# Proma Web App

Run `yarn s3rver` and add seeds with:

```
aws --endpoint http://localhost:4568 --profile s3local s3 cp --recursive seeds s3://proma-projects
```