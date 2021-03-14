import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import dynamodb from './lib/dynamodb';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const db = dynamodb();
  const data = await db
    .scan({
      TableName: 'users',
      Limit: 10,
    })
    .promise();
  const item = data.Items![0].name;
  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        message: 'Hello!',
        // input: event,
        item,
      },
      null,
      2,
    ),
  };
};
