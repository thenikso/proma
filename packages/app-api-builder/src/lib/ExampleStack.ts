import {
  LambdaIntegration,
  MethodLoggingLevel,
  RestApi,
} from '@aws-cdk/aws-apigateway';
import { PolicyStatement } from '@aws-cdk/aws-iam';
import { Function, Runtime, Code } from '@aws-cdk/aws-lambda';
import { Construct, Duration, Stack, StackProps } from '@aws-cdk/core';

export class ExampleStack extends Stack {
  private restApi: RestApi;
  private lambdaFunction: Function;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    this.restApi = new RestApi(this, this.stackName + 'RestApi', {
      deployOptions: {
        stageName: 'beta',
        metricsEnabled: true,
        loggingLevel: MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
      },
    });

    // const lambdaPolicy = new PolicyStatement();
    // lambdaPolicy.addActions("s3:ListBucket")
    // lambdaPolicy.addResources(this.bucket.bucketArn)

    const functionName = this.stackName + 'Function';
    const code = `'use strict';
      module.exports.handler = async (event) => {
        console.log('got an event')
        return {
          statusCode: 200,
          body: JSON.stringify(
            {
              message: 'Hello!' + process.env.EXAMPLE,
              input: event,
            },
            null,
            2,
          ),
        };
      };
    `;
    this.lambdaFunction = new Function(this, functionName, {
      functionName: functionName,
      handler: 'index.handler',
      runtime: Runtime.NODEJS_12_X,
      code: Code.fromInline(code),
      memorySize: 512,
      timeout: Duration.seconds(10),
      environment: {
        EXAMPLE: 'hey',
      },
      // initialPolicy: [lambdaPolicy],
    });

    this.restApi.root.addMethod(
      'GET',
      new LambdaIntegration(this.lambdaFunction, {}),
    );
  }
}
