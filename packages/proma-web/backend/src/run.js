import { defer, error, btoa, interceptStdout, timeout } from './lib/utils';
import aws from './lib/aws';
import * as proma from '@proma/core';
import fetch from 'node-fetch';
import eq from 'fast-deep-equal';

export const endpoint = async (event) => {
  // TODO the user id should be here or in some other authorizer prop
  // console.log(event.requestContext.authorizer.principalId);

  // TODO if mapping from a URL like `<host>.proma.app/project/func` we would
  // need to extract the hostId from the domain

  let { hostId, projectSlug, endpoint } = event.pathParameters;
  if (!projectSlug) {
    projectSlug = 'default';
  }
  if (!endpoint) {
    endpoint = 'index';
  }

  // TODO capture logs and invocations for reporting and billing
  const logs = [];
  const errors = [];
  const releaseLogCapture = interceptStdout(
    (s) => {
      logs.push(s);
    },
    (s) => {
      errors.push(s);
    },
  );

  const endpointPath = `/${hostId}/${projectSlug}/${endpoint}`;
  console.info(`[inform] Running endpoint "${endpointPath}"...`);

  // Read project info from databast
  let project;
  try {
    project = (
      await aws.db
        .get({
          TableName: process.env.DYNAMODB_PROJECTS_TABLE,
          Key: {
            projectSlug,
            ownerHostId: hostId,
          },
        })
        .promise()
    ).Item;
  } catch (e) {
    releaseLogCapture();
    return error(404, e);
  }

  // Get endpoint
  const projectFiles = Array.from(Object.entries(project.files || {}));
  const endpoints = projectFiles.filter(([fileName]) =>
    fileName.startsWith(`endpoints/${endpoint}.`),
  );
  if (endpoints.length === 0) {
    releaseLogCapture();
    return error(
      404,
      `Can not find endpoint ${hostId}/${projectSlug}/endpoints/${endpoint}.*`,
    );
  }

  // TODO search for best endpoint match if multiple
  const [, endpointBase64] = endpoints[0];

  // Construct chip
  let chipInstance;
  let chipErrors;
  try {
    const endpointChipSource = JSON.parse(btoa(endpointBase64));
    const chipClass = proma.fromJSON(
      proma.chip,
      endpointChipSource,
      (errors) => {
        chipErrors = errors;
      },
    );
    // TODO can not give access to `global`. Use something like `entrypointGlobal.ts`
    // to mask all global objects
    const chipCompiledClass = await chipClass.compiledClass(
      { fetch },
      (importUrl) => {
        const parts = importUrl.split('/');
        const name = parts[parts.length - 1];
        console.info(`[inform] attempt to import "${importUrl}" as "${name}"`);
        switch (name) {
          case 'fast-deep-equal':
            return eq;
          default:
            throw new Error(`Can not import module '${importUrl}'`);
        }
      },
    );
    chipInstance = new chipCompiledClass(event);
  } catch (e) {
    releaseLogCapture();
    return error(400, e);
  }

  // Execute chip
  const deferred = defer();
  try {
    chipInstance.out.then(() => {
      deferred.resolve(chipInstance.out.result());
    });
    chipInstance.in.exec();
  } catch (e) {
    releaseLogCapture();
    return error(400, e);
  }

  // Wait for result
  let chipResult;
  try {
    chipResult = await Promise.race([
      deferred.promise,
      timeout(5000, new Error('timeout (5s)')),
    ]);
  } catch (e) {
    releaseLogCapture();
    return error(400, e);
  }

  // Destroy chip
  chipInstance.destroy();

  console.info('[result] Completed request');
  releaseLogCapture();

  const result = {
    statusCode: chipResult.statusCode || 200,
    body: JSON.stringify(
      {
        result: chipResult.body || chipResult,
        chipErrors,
        logs,
        error: errors,
      },
      null,
      2,
    ),
  };

  return result;
};
