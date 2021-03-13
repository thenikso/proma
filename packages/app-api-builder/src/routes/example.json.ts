import type { Request, Response } from 'express';
import { App } from '@aws-cdk/core';
import { ExampleStack } from '../lib/ExampleStack';

import { SdkProvider } from 'aws-cdk/lib/api/aws-auth';
import { CloudFormationDeployments } from 'aws-cdk/lib/api/cloudformation-deployments';

export async function get(req: Request, res: Response): Promise<void> {
  res.writeHead(200, {
    'Content-Type': 'application/json',
  });

  res.end(
    JSON.stringify({
      message: `Ok GET`,
    }),
  );
}

export async function post(req: Request, res: Response): Promise<void> {
  const app = new App();
  const stack = new ExampleStack(app, 'PromaExampleLambdaApiStack', {});

  const stackArtifact = app.synth().getStackByName(stack.stackName);

  const sdkProvider = await SdkProvider.withAwsCliCompatibleDefaults({
    profile: 'nikso-proma',
  });
  const cloudFormation = new CloudFormationDeployments({ sdkProvider });
  const deployResult = await cloudFormation.deployStack({
    stack: stackArtifact,
  });

  res.writeHead(200, {
    'Content-Type': 'application/json',
  });

  res.end(
    JSON.stringify({
      stack: stack.stackName,
      deployResult,
    }),
  );
}
