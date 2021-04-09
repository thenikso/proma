import { ok, error } from './lib/utils';
import aws from './lib/aws';
import { Permissions } from './lib/auth';

export async function handler(event) {
  //
  // Authorization
  //

  // TODO transform to custom project authorizer?

  const { hostId, projectSlug = 'default' } = event.pathParameters;
  const permissions = Permissions.from(
    event.requestContext.authorizer.permissions,
    'project',
  );
  const userId = event.requestContext.authorizer.principalId;
  const httpMethod = event.httpMethod;

  if (!permissions.allowHttpMethod(httpMethod)) {
    return error(403);
  }

  let host;
  try {
    host = (
      await aws.db
        .get({
          TableName: process.env.DYNAMODB_HOSTS_TABLE,
          Key: {
            hostId,
          },
        })
        .promise()
    ).Item;
  } catch (e) {
    return error(404, e);
  }

  if (!permissions.isAdmin && userId !== host.ownerUserId) {
    return error(403);
  }

  //
  // Execution
  //

  switch (httpMethod) {
    case 'GET':
      return get(event);
    case 'POST':
      return post(event);
    default:
      return error(400, `Method not supported: ${httpMethod}`);
  }
}

async function get(event) {
  // TODO also support file query param to only read a file?
  const { hostId, projectSlug = 'default' } = event.pathParameters;
  const userId = event.requestContext.authorizer.principalId;

  const projectPrefix = `${hostId}/${projectSlug}/`;

  let projectContents;
  try {
    // TODO use functionData.Item!.chipSourceUrl instead
    projectContents = (
      await aws.s3
        .listObjectsV2({
          Bucket: process.env.S3_PROJECT_DATA_BUCKET,
          Prefix: projectPrefix,
        })
        .promise()
    ).Contents.map((c) => c.Key);
    // TODO account for `IsTruncated` aka pagination
  } catch (e) {
    return error(404, e);
  }

  const files = {};
  for (const fileKey of projectContents) {
    let fileData;
    try {
      const s3obj = await aws.s3
        .getObject({
          Bucket: process.env.S3_PROJECT_DATA_BUCKET,
          Key: fileKey,
        })
        .promise();
      fileData = s3obj.Body.toString('base64');
    } catch (e) {
      return error(404, e);
    }
    files[fileKey.substr(projectPrefix.length)] = fileData;
  }

  return ok({
    projectSlug,
    ownerHostId: hostId,
    files,
  });
}

async function post(event) {
  // TODO transform to save in bucket

  const { hostId, projectSlug = 'default' } = event.pathParameters;

  // TODO account to save single file
  const { file } = event.queryStringParameters || {};

  const projectPrefix = `${hostId}/${projectSlug}/`;
  const project = JSON.parse(event.body);

  for (const [fileKey, fileContent] of Object.entries(project.files)) {
    try {
      await aws.s3
        .putObject({
          Bucket: process.env.S3_PROJECT_DATA_BUCKET,
          // TODO validate key
          Key: projectPrefix + fileKey,
          Body: Buffer.from(fileContent, 'base64'),
        })
        .promise();
    } catch (e) {
      // TODO ?
      console.error(e);
    }
  }

  return ok({
    projectSlug,
    ownerHostId: hostId,
  });
}
