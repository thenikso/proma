import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const client = jwksClient({
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

const arnRegexp = /^arn:aws:(?<operation>[^:]+):(?<region>[^:]+):(?<account>[^:]+):(?<apiId>[^\/]+)\/(?<stage>[^\/]+)\/(?<httpMethod>[^\/]+)(?<route>.+)$/i;

// TODO this is a dumb authorizer to test what kind of informations we could
// send to the lambda using it. It should eventually be converted to use auth0
export const handler = async (event) => {
  if (!event.authorizationToken) {
    throw new Error('Missing authorization token');
  }

  const token = event.authorizationToken.substr('Bearer '.length);
  const decodedJwt = jwt.decode(token, { complete: true });
  if (!decodedJwt) {
    throw new Error('Invalid authorization token');
  }

  const key = await client.getSigningKey(decodedJwt.header.kid);

  const { aud: audience, sub: userId, permissions } = await getJwtClaims(
    token,
    key,
  );
  const [, , region, account, apiId, stage, httpMethod, route] =
    arnRegexp.exec(event.methodArn) || [];

  if (!audience.includes(process.env.SERVICE)) {
    return denyAllPolicy();
  }

  return allowPolicy(
    event.methodArn,
    decodedJwt.payload.sub,
    decodedJwt.payload.permissions,
  );
};

function getJwtClaims(token, key) {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      key.publicKey || key.rsaPublicKey,
      {
        // TODO understand options
      },
      function (error, claims) {
        if (error) {
          reject(error);
        } else {
          resolve(claims);
        }
      },
    );
  });
}

function allowPolicy(methodArn, principalId, permissions) {
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

  if (permissions && permissions.length > 0) {
    policy.context = {
      permissions: permissions.join(','),
    };
  }

  return policy;
}

function denyAllPolicy() {
  return {
    principalId: '*',
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: '*',
          Effect: 'Deny',
          Resource: '*',
        },
      ],
    },
  };
}
