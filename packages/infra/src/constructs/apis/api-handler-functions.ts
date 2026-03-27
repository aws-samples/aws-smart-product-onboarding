/**
 * Custom Lambda function constructs for API handlers that point to the new workspace location.
 * These override the generated functions to use the correct path after migration to uv workspace.
 */

import * as path from "path";
import { Duration } from "aws-cdk-lib";
import {
  Architecture,
  Code,
  Function,
  Runtime,
  Tracing,
  FunctionProps,
} from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

/**
 * Options for the CreateBatchExecutionFunction construct
 */
export interface CreateBatchExecutionFunctionProps
  extends Omit<FunctionProps, "code" | "handler" | "runtime"> {}

/**
 * Lambda function construct which points to the python implementation of CreateBatchExecution
 */
export class CreateBatchExecutionFunction extends Function {
  constructor(
    scope: Construct,
    id: string,
    props?: CreateBatchExecutionFunctionProps,
  ) {
    super(scope, id, {
      runtime: Runtime.PYTHON_3_13,
      handler:
        "amzn_smart_product_onboarding_api_python_handlers.create_batch_execution.handler",
      code: Code.fromAsset(
        path.resolve(
          __dirname,
          "..",
          "..",
          "..",
          "..",
          "smart-product-onboarding/api/handlers/dist/lambda",
        ),
      ),
      architecture: Architecture.ARM_64,
      tracing: Tracing.ACTIVE,
      timeout: Duration.seconds(30),
      ...props,
    });
  }
}

/**
 * Options for the DownloadFileFunction construct
 */
export interface DownloadFileFunctionProps
  extends Omit<FunctionProps, "code" | "handler" | "runtime"> {}

/**
 * Lambda function construct which points to the python implementation of DownloadFile
 */
export class DownloadFileFunction extends Function {
  constructor(scope: Construct, id: string, props?: DownloadFileFunctionProps) {
    super(scope, id, {
      runtime: Runtime.PYTHON_3_13,
      handler:
        "amzn_smart_product_onboarding_api_python_handlers.download_file.handler",
      code: Code.fromAsset(
        path.resolve(
          __dirname,
          "..",
          "..",
          "..",
          "..",
          "smart-product-onboarding/api/handlers/dist/lambda",
        ),
      ),
      architecture: Architecture.ARM_64,
      tracing: Tracing.ACTIVE,
      timeout: Duration.seconds(30),
      ...props,
    });
  }
}

/**
 * Options for the GetBatchExecutionFunction construct
 */
export interface GetBatchExecutionFunctionProps
  extends Omit<FunctionProps, "code" | "handler" | "runtime"> {}

/**
 * Lambda function construct which points to the python implementation of GetBatchExecution
 */
export class GetBatchExecutionFunction extends Function {
  constructor(
    scope: Construct,
    id: string,
    props?: GetBatchExecutionFunctionProps,
  ) {
    super(scope, id, {
      runtime: Runtime.PYTHON_3_13,
      handler:
        "amzn_smart_product_onboarding_api_python_handlers.get_batch_execution.handler",
      code: Code.fromAsset(
        path.resolve(
          __dirname,
          "..",
          "..",
          "..",
          "..",
          "smart-product-onboarding/api/handlers/dist/lambda",
        ),
      ),
      architecture: Architecture.ARM_64,
      tracing: Tracing.ACTIVE,
      timeout: Duration.seconds(30),
      ...props,
    });
  }
}

/**
 * Options for the ListBatchExecutionsFunction construct
 */
export interface ListBatchExecutionsFunctionProps
  extends Omit<FunctionProps, "code" | "handler" | "runtime"> {}

/**
 * Lambda function construct which points to the python implementation of ListBatchExecutions
 */
export class ListBatchExecutionsFunction extends Function {
  constructor(
    scope: Construct,
    id: string,
    props?: ListBatchExecutionsFunctionProps,
  ) {
    super(scope, id, {
      runtime: Runtime.PYTHON_3_13,
      handler:
        "amzn_smart_product_onboarding_api_python_handlers.list_batch_executions.handler",
      code: Code.fromAsset(
        path.resolve(
          __dirname,
          "..",
          "..",
          "..",
          "..",
          "smart-product-onboarding/api/handlers/dist/lambda",
        ),
      ),
      architecture: Architecture.ARM_64,
      tracing: Tracing.ACTIVE,
      timeout: Duration.seconds(30),
      ...props,
    });
  }
}

/**
 * Options for the UploadFileFunction construct
 */
export interface UploadFileFunctionProps
  extends Omit<FunctionProps, "code" | "handler" | "runtime"> {}

/**
 * Lambda function construct which points to the python implementation of UploadFile
 */
export class UploadFileFunction extends Function {
  constructor(scope: Construct, id: string, props?: UploadFileFunctionProps) {
    super(scope, id, {
      runtime: Runtime.PYTHON_3_13,
      handler:
        "amzn_smart_product_onboarding_api_python_handlers.upload_file.handler",
      code: Code.fromAsset(
        path.resolve(
          __dirname,
          "..",
          "..",
          "..",
          "..",
          "smart-product-onboarding/api/handlers/dist/lambda",
        ),
      ),
      architecture: Architecture.ARM_64,
      tracing: Tracing.ACTIVE,
      timeout: Duration.seconds(30),
      ...props,
    });
  }
}
