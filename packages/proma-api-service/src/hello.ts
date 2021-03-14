import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import aws from './lib/aws';
import * as proma from '@proma/core';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const data = await aws.db
    .scan({
      TableName: 'users',
      Limit: 10,
    })
    .promise();
  const item = data.Items![0].name;

  // Load chip data
  let chipData: any;
  try {
    const s3obj = await aws.s3
      .getObject({
        Bucket: 'proma-projects',
        Key: 'example/greet.json',
      })
      .promise();
    chipData = JSON.parse(s3obj.Body!.toString('utf8'));
  } catch (e) {
    console.error('Could not read function chip file');
    console.error(e);
  }

  let handler: any;
  if (chipData) {
    const Handler = proma.fromJSON(proma.chip, chipData);
    // new Handler()
    const HandlerCode = Handler.compile();

    const makeCompiledHandler = new Function('return (' + HandlerCode + ')');
    // We can either use the live or compiled version, based on environment
    handler = new (makeCompiledHandler())();
    // Save in cache
    // hit = { handler, time: codeCachedAtTime, environment };
  }

  let result: Promise<string> | undefined;
  if (handler) {
    // Setup handler execution as a promise and execute
    const deferred = defer<string>();
    handler.in.query = event.queryStringParameters;
    handler.out.then(() => {
      deferred.resolve(handler.out.result());
    });
    handler.in.exec();
    result = deferred.promise;
  }

  console.log(result);

  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        message: 'Hello!',
        // input: event,
        item,
        chipResult: await result,
      },
      null,
      2,
    ),
  };
};

function defer<T>() {
  const result: any = {
    promise: null,
    resolve: null,
    reject: null,
  };
  result.promise = new Promise<T>((res, rej) => {
    result.resolve = res;
    result.reject = rej;
  });
  return result as {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: any) => void;
  };
}
