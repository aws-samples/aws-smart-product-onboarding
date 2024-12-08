# Smart Product Onboarding Notebooks

This folder contains Jupyter notebooks for preparing and configuring the Smart Product Onboarding accelerator. These notebooks are crucial for setting up the category tree, generating metaclasses, and configuring the system for your specific use case.

## Prerequisites

Before running these notebooks, ensure you have completed the CDK deployment as described in the main project README.md. The notebooks depend on an S3 bucket and SSM Parameter Store parameter created during this deployment.

## Setup
You can run the notebooks locally or in Sagemaker Studio.

### Local Environment
1. Install Poetry (if not already installed):
```
pip install poetry>=1.5.1,<1.9
```

2. From this directory(*notebooks/*), install dependencies:
```
poetry install --no-root
```


3. Activate the virtual environment:
```
poetry shell
```

4. Launch jupyter:
```
jupyter notebook
```

### SageMaker Studio Jupyterlab

1. Open a new terminal in SageMaker Studio Jupyterlab.

2. Install Poetry:
```
pip install poetry>=1.5.1,<1.9
```

3. From this directory(*notebooks/*), install dependencies:
```
POETRY_VIRTUALENVS_CREATE=false poetry install --no-root
```

## Running the Notebooks

1. Open and run the notebooks in order:
- `1 - category tree prep.ipynb`
- `2 - metaclasses generation.ipynb`

2. Follow the instructions within each notebook carefully. They guide you through:
- Preparing your category tree
- Generating metaclasses
- Configuring the system for your specific use case

3. After running the notebooks, the accelerator will be configured and operational.

## Important Notes

- These notebooks use the TextCleaner class from the `metaclasses` package. Ensure you're running the notebooks from the project root directory so that all dependencies are correctly resolved.

- The notebooks will save configuration files to the S3 bucket created during the CDK deployment. Make sure you have the necessary permissions to write to this bucket.

- If you encounter any issues related to missing dependencies, ensure you've installed all project dependencies as described in the Setup section.

- Remember to adapt the category tree and attribute schemas to your specific needs. The examples provided are based on the GS1 Global Product Classification (GPC) standard, but you can use your own category structure.

After successfully running these notebooks, your Smart Product Onboarding accelerator will be fully configured and ready for use. Refer to the main project README.md for instructions on how to use the configured system.
