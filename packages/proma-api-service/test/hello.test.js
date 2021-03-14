import AWS from 'aws-sdk';
import { handler as hello } from '../src/hello';

describe('who tests the tests?', () => {
  afterEach(() => AWS.clearAllMocks());

  it('can run a test', async () => {
    AWS.spyOnPromise('DynamoDB.DocumentClient', 'scan', {
      Items: [{ name: 'Test' }],
    });

    expect(await hello({ event: true })).toEqual({
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
