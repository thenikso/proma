import { ok, error } from './lib/utils';
import aws from './lib/aws';

export const get = async (event) => {
  let { hostId, projectSlug } = event.pathParameters;
  if (!projectSlug) {
    projectSlug = 'default';
  }

  console.log(event.requestContext.authorizer);

  // TODO check that user has read access to host/project

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
    return error(404, e);
  }

  // // Read function source
  // let itemData: any;
  // try {
  //   // TODO use functionData.Item!.chipSourceUrl instead
  //   const s3obj = await aws.s3
  //     .getObject({
  //       Bucket: process.env.S3_PROJECT_DATA_BUCKET!,
  //       Key: projectItem.chipSourceKey,
  //     })
  //     .promise();
  //   itemData = s3obj.Body!.toString('base64');
  // } catch (e) {
  //   return error(404, e);
  // }

  return ok(project);
};

export const post = async (event) => {
  let { hostId, projectSlug } = event.pathParameters;
  if (!projectSlug) {
    projectSlug = 'default';
  }

  try {
    const project = JSON.parse(event.body);
    await aws.db
      .put({
        TableName: process.env.DYNAMODB_PROJECTS_TABLE,
        Item: {
          projectSlug,
          ownerHostId: hostId,
          files: project.files,
        },
      })
      .promise();
  } catch (e) {
    return error(400, e);
  }

  return ok({
    projectSlug,
    ownerHostId: hostId,
  });
};
