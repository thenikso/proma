import type { APIGatewayTokenAuthorizerHandler } from 'aws-lambda';

// TODO this is a dumb authorizer to test what kind of informations we could
// send to the lambda using it. It should eventually be converted to use auth0
export const handler: APIGatewayTokenAuthorizerHandler = async (event) => {
  if (!event.authorizationToken) {
    throw new Error('Unauthorized');
  }

  const token = event.authorizationToken.substr('Bearer '.length);

  return buildAllowAllPolicy(event.methodArn, token);
};

function buildAllowAllPolicy(methodArn: string, principalId: string) {
  const [, , , awsRegion, awsAccountId, apiGatewayPath] = methodArn.split(':');
  const [restApiId, stage] = apiGatewayPath.split('/');
  const apiArn = `arn:aws:execute-api:${awsRegion}:${awsAccountId}:${restApiId}/${stage}/*/*`;
  const policy = {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: 'Allow',
          Resource: [apiArn],
        },
      ],
    },
  };

  return policy;
}
