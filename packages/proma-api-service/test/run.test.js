import AWS from 'aws-sdk';
import { handler as run } from '../src/run';

describe('who tests the tests?', () => {
  afterEach(() => AWS.clearAllMocks());

  it('can run a test', async () => {
    AWS.spyOnPromise('DynamoDB.DocumentClient', 'scan', {
      Items: [{ name: 'Test' }],
    });

    expect(await run({ event: true })).toEqual({
      statusCode: 200,
      body: JSON.stringify(
        {
          message: 'Hello!',
          item: 'Test',
        },
        null,
        2,
      ),
    });
  });
});
