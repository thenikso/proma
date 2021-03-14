import AWS from 'aws-sdk';

const localOptions = {
  region: 'localhost',
  endpoint: 'http://localhost:8000',
};

class AWSResources {
  get db() {
    return new AWS.DynamoDB.DocumentClient(
      process.env.IS_OFFLINE ? localOptions : {},
    );
  }
}

const awsResources = new AWSResources();

export default awsResources;
