# Security

## Shared Responsibility Model

Security and Compliance is a shared responsibility between AWS and the customer.
This shared model can help relieve the customer’s operational burden as AWS operates, manages and controls the
components from the host operating system and virtualization layer down to the physical security of the facilities in
which the service operates.
The customer assumes responsibility and management of the guest operating system (includ- ing updates and security
patches), other associated application software as well as the configura- tion of the AWS provided security group
firewall. Customers should carefully consider the services they choose as their responsibilities vary depending on the
services used, the integration of those services into their IT environment, and applicable laws and regulations. The
nature of this shared responsibility also provides the flexibility and customer control that permits the deployment. As
shown in the chart below, this differentiation of responsibility is commonly referred to as Security “of” the Cloud
versus Security “in” the Cloud.
For more details, please refer
to [AWS Shared Responsibility Model](https://aws.amazon.com/compliance/shared-responsibility-model/).

## Cognito

You may change password policies
and [activate MFA](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-mfa.html) in the Cognito
User Pool in the `DemoUserPool` resource in *packages/infra/src/stacks/application-stack.ts*.

If you activate MFA, you may also need to increase
your [SNS SMS spending quota](https://docs.aws.amazon.com/sns/latest/dg/channels-sms-awssupport-spend-threshold.html).
Once the limit is reached, Cognito's MFA messages will not get delivered, and no one will be able to login.

## IAM Governance

AWS has a series
of [best practices and guidelines](https://docs.aws.amazon.com/IAM/latest/UserGuide/IAMBestPracticesAndUseCases.html)
around IAM.

### AWS Managed Policies

In this accelerator, we used the default AWSLambdaBasicExecutionRole AWS Managed Policy to facilitate development. AWS
Managed Policies don’t grant least privileges in order to cover common use cases. The best practice it to write a custom
policy with only the permissions needed by the task.
More information: https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html#bp-use-aws-defined-policies.

### Wildcard Policies

In this accelerator, some policies use wildcards to specify resources to expedite development. The best practice is to
create policies that grant least privileges.
More information: https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html#grant-least-privilege

## S3

Amazon S3 provides a number of security features to consider as you develop and implement your own security policies.
The following best practices are general guidelines and don’t represent a complete security solution. Because these best
practices might not be appropriate or sufficient for your environment, treat them as helpful considerations rather than
prescriptions.

For an in-depth description of best practices around S3, please refer
to [Security Best Practices for Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html).
At a minimum we recommend that you:

1. Ensure that your Amazon S3 buckets use the correct policies and are not publicly accessible;
2. Implement least privilege access;
3. Consider encryption at-rest (on disk);
4. Enforce encryption in-transit by restricting access using secure transport (TLS);
5. Enable object versioning when applicable; and
6. Enable cross-region replication as a disaster recovery strategy;
7. Consider if the data stored in the buckets warrants enabling MFA delete.

## Configure Cross-Origin Resource Sharing (CORS)

CORS is a mechanism that uses additional HTTP headers to tell a browser to let a
web application running at one origin (domain) have permission to access selected
resources from a server at a different origin.

CORS is enabled to allow requests from the demo web app running locally only. In production, you should restrict it to
your domain on API Gateway and the S3 input and output buckets.

## API Gateway

In this accelerator, the API has a public facing endpoint protected by AWS WAF. It only allows authorized users from
Amazon Cognito. You should evaluate if you need to further protect the API endpoint using the following options:

* Restrict access to specific [Source IPs with WAF](https://repost.aws/knowledge-center/waf-allow-my-ip-block-other-ip).
* Restrict access to a specific VPC as
  a [private REST API](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-private-apis.html).

## DynamoDB

In this accelerator, we used DynamoDB to store the state of executions. You may want to activate backup strategies for
DynamoDB tables. Amazon DynamoDB service can back up the data with per-second granularity and restore it to any single
second from the time PITR was enabled up to the prior 35 days. DynamoDB continuous backups represent an additional layer
of insurance against accidental loss of data on top of on-demand backups. You can find more details
in https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Backups.html.

## CDK/CloudFormation

You can prevent stacks from being accidentally deleted by enabling termination protection on the stack. If a user
attempts to delete a stack with termination protection enabled, the deletion fails and the stack, including its status,
remains unchanged. For more details on how to enable the deletion protection, refer to [
`termination_protection` configuration](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib-readme.html#termination-protection).