import AWS from 'aws-sdk';

const isOffline = process.env.IS_OFFLINE;

class AWSResources {
  get db() {
    return new AWS.DynamoDB.DocumentClient(
      isOffline
        ? {
            accessKeyId: 'DEFAULT_ACCESS_KEY',
            secretAccessKey: 'DEFAULT_SECRET',
            region: 'localhost',
            endpoint: 'http://localhost:8000',
          }
        : {},
    );
  }
  get s3() {
    return new AWS.S3(
      isOffline
        ? {
            accessKeyId: 'S3RVER', // This specific key is required when working offline
            secretAccessKey: 'S3RVER',
            s3ForcePathStyle: true,
            endpoint: 'http://localhost:4569',
          }
        : {},
    );
  }
}

const awsResources = new AWSResources();

export default awsResources;
