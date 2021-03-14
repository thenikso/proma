import AWS from 'aws-sdk';

const localOptions = {
  region: 'localhost',
  endpoint: 'http://localhost:8000',
};

export default function ddb() {
  return new AWS.DynamoDB.DocumentClient(
    process.env.IS_OFFLINE ? localOptions : {},
  );
}
