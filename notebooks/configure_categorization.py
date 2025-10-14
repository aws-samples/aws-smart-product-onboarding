#!/usr/bin/env python3
"""
Smart Product Onboarding - Post-Deployment Configuration Script

This script automates the configuration steps from the Jupyter notebooks:
- 1 - category tree prep.ipynb
- 2 - metaclasses generation.ipynb

Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0
"""

import argparse
import json
import sys
import os
import hashlib
import time
import io
import gzip
import tempfile
from pathlib import Path
from collections import Counter
from decimal import Decimal
from typing import Dict, List, Set, Any, Tuple
from urllib.parse import urlparse

import boto3
import pandas as pd
import numpy as np
import requests
import faiss
from amazon.ion import simpleion

# Constants
SSM_PREFIX = "/ProductCategorization/"
VECTOR_TABLE_PREFIX = "SmartProductOnboarding-"
DEFAULT_EMBEDDINGS_MODEL_URL = (
    "https://dl.fbaipublicfiles.com/fasttext/vectors-english/crawl-300d-2M.vec.zip",
    "bb43875cfae187e8cef0be558a1851fb1c62daca",
)

# Default configuration
DEFAULT_SINGULARIZE_EXCEPTIONS = {
    "clothes": "clothes",
    "canvas": "canvas",
    "fruticosus": "fruticosus",
    "dies": "die",
    "lotus": "lotus",
    "tinctorius": "tinctorius",
    "gymnastics": "gymnastics",
    "mollis": "mollis",
    "myosotis": "myosotis",
    "australis": "australis",
    "gas": "gas",
    "gps": "gps",
    "guatemalensis": "guatemalensis",
    "elegans": "elegans",
    "christmas": "christmas",
    "cosmos": "cosmos",
    "xps": "xps",
    "muralis": "muralis",
    "narcissus": "narcissus",
    "barbatus": "barbatus",
    "cactus": "cactus",
    "hibiscus": "hibiscus",
    "callus": "callus",
    "cycas": "cycas",
    "prunus": "prunus",
    "overalls": "overalls",
    "nitrous": "nitrous",
    "bellis": "bellis",
    "coreopsis": "coreopsis",
    "iris": "iris",
    "erinus": "erinus",
    "plectranthus": "plectranthus",
    "euryops": "euryops",
    "hyacinthus": "hyacinthus",
    "rhipsalidopsis": "rhipsalidopsis",
    "cos": "cos",
    "orientalis": "orientalis",
    "annuus": "annuus",
    "lotononis": "lotononis",
    "sylvestris": "sylvestris",
    "argus": "argus",
    "sinensis": "sinensis",
    "crocus": "crocus",
    "corylus": "corylus",
    "edulis": "edulis",
    "paris": "paris",
    "helianthus": "helianthus",
    "orchis": "orchis",
    "zamioculcas": "zamioculcas",
    "psoriasis": "psoriasis",
    "stylus": "stylus",
    "abies": "abies",
    "cupressus": "cupressus",
    "grandis": "grandis",
    "hupehensis": "hupehensis",
    "pinus": "pinus",
    "cannabis": "cannabis",
    "cucumis": "cucumis",
    "ficus": "ficus",
    "physalis": "physalis",
    "corniculatus": "corniculatus",
    "dypsis": "dypsis",
    "vulgaris": "vulgaris",
    "nephrolepis": "nephrolepis",
    "gracilis": "gracilis",
    "asiaticus": "asiaticus",
    "babacos": "babacos",
    "helleborus": "helleborus",
    "lupinus": "lupinus",
    "rhapis": "rhapis",
    "cyperus": "cyperus",
    "ruscus": "ruscus",
    "opulus": "opulus",
    "lutescens": "lutescens",
    "perennis": "perennis",
    "index": "index",
}

DEFAULT_DESCRIPTORS = [
    "accessory",
    "live",
    "part",
    "replacement",
    "equipment",
    "product",
    "cut",
    "ready",
    "prepared",
    "processed",
    "unprepared",
    "unprocessed",
    "sport",
    "baby",
    "garden",
    "non",
    "kit",
    "set",
    "pack",
]

DEFAULT_SYNONYMS = {"sneaker": "shoe"}

# Media categories to always include
ALWAYS_CATEGORY_IDS = [
    "68040100",  # Pre-Recorded or Digital Content Media
    "68050100",  # Audio Visual/Photography Variety Packs
    "65010400",  # Computer/Video Game Software
    "65010900",  # Computers/Video Games Variety Packs
    "60010200",  # Books
    "60010300",  # Periodicals
    "10001194",  # GPS Software - Mobile Communications
    "10006237",  # GPS Software - Mobile Communications - Digital
    "10001197",  # Mobile Phone Software
    "10006238",  # Mobile Phone Software - Digital
    "10000624",  # Cross Segment Variety Packs
    "10002103",  # Textual/Printed/Reference Materials Variety Packs
]


class ConfigurationError(Exception):
    """Custom exception for configuration errors"""

    pass


def secure_download(url: str, destination: str) -> None:
    """Securely download a file from a URL"""
    parsed_url = urlparse(url)
    if parsed_url.scheme != "https":
        raise ValueError("URL must use HTTPS")

    response = requests.get(url, timeout=30, verify=True, stream=True)
    response.raise_for_status()

    with open(destination, "wb") as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)


def vector_generator(fname: str):
    """Generate word vectors from a fastText file"""
    fin = io.open(fname, "r", encoding="utf-8", newline="\n", errors="ignore")
    n, d = map(int, fin.readline().split())
    count = 0
    for line in fin:
        if count % 100000 == 0:
            print(f"Processing vectors: {count}/{n}")
        tokens = line.rstrip().split(" ")
        word: str = tokens[0]
        if word.isalpha():
            yield {"Item": {"word": word, "vector": list(map(Decimal, tokens[1:]))}}
        count += 1


def get_embeddings_models(
    model_urls: List[Tuple[str, str]], data_dir: Path
) -> List[str]:
    """Download and extract embeddings models"""
    import zipfile

    files = []
    for model_url in model_urls:
        (url, checksum) = (
            model_url if isinstance(model_url, tuple) else (model_url, "0")
        )
        vecfile_basename = os.path.basename(url)
        dest_path = data_dir / vecfile_basename

        should_download = True
        if dest_path.exists():
            with open(dest_path, "rb", buffering=0) as f:
                sha1 = hashlib.file_digest(f, "sha1").hexdigest()
            if checksum == sha1:
                should_download = False
                print(f"Using cached embeddings: {vecfile_basename}")

        if should_download:
            print(f"Downloading embeddings from {url}...")
            secure_download(url, str(dest_path))
            with open(dest_path, "rb", buffering=0) as f:
                sha1 = hashlib.file_digest(f, "sha1").hexdigest()
            print(f"Downloaded: {url} (SHA1: {sha1})")

        if vecfile_basename.endswith(".zip"):
            print(f"Extracting embeddings {url}")
            with zipfile.ZipFile(dest_path, "r") as zip_ref:
                zip_ref.extractall(data_dir)
            print(f"Extracted embeddings {url}")
            files.append(str(data_dir / vecfile_basename.replace(".zip", "")))
        elif vecfile_basename.endswith(".vec"):
            files.append(str(dest_path))

    return files


def iterate_category_tree(tree: Dict, path: List = None) -> Dict:
    """Recursively iterate through category tree"""
    if path is None:
        path = []

    if tree["Level"] <= 4:
        path.append({"id": str(tree["Code"]), "name": tree["Title"]})

        childs = []
        for child in tree.get("Childs", []):
            if child["Level"] <= 4:
                childs.append(
                    {
                        "id": str(child["Code"]),
                        "name": child["Title"],
                    }
                )
                yield from iterate_category_tree(child, path)

        yield {
            "id": str(tree["Code"]),
            "name": tree["Title"],
            "full_path": path.copy(),
            "description": tree["Definition"],
            "childs": childs,
        }
        path.pop()


def build_attribute_dict(data: Dict, full_path: str = "") -> Dict:
    """Build attribute dictionary from GPC data"""
    result = {}

    if data["Level"] <= 4:
        if data["Level"] == 4:
            result[data["Code"]] = {
                "category": data["Title"],
                "subcategory": full_path,
                "attributes_schema": data["Childs"] if data["Childs"] else None,
            }
        else:
            for child in data.get("Childs", []):
                result.update(
                    build_attribute_dict(
                        child, full_path=f"{full_path}/{data['Title']}"
                    )
                )
    else:
        return data["Childs"]

    return result


def optimize_dict(target: Any) -> Any:
    """Optimize attribute dictionary by removing unnecessary fields"""
    if isinstance(target, list):
        return [optimize_dict(elm) for elm in target]

    if target is None:
        return

    if not target.get("Active", False):
        return

    new_dict = {
        k: v
        for k, v in target.items()
        if v is not None and k not in ["Code", "Level", "Childs", "Active"]
    }
    if "Childs" in target and target["Childs"] is not None:
        new_dict["Childs"] = optimize_dict(target["Childs"])

    return new_dict


def get_leaf_categories(cat_tree: Dict) -> List[Dict]:
    """Extract leaf categories from category tree"""
    leaf_categories = []
    for cat_id in cat_tree:
        if cat_id == "root":
            continue
        category = cat_tree[cat_id]
        if len(category.get("childs", [])) <= 0:
            leaf_categories.append(
                {
                    "name": category["name"],
                    "id": category["id"],
                    "description": category["description"],
                }
            )
    return leaf_categories


def get_child_category_ids(cat_ids: List[str], category_tree: Dict) -> List[str]:
    """Get all child category IDs recursively"""
    categories = []
    for cat_id in cat_ids:
        if not category_tree[cat_id]["childs"]:
            categories.append(cat_id)
        else:
            categories.extend(
                get_child_category_ids(
                    [child["id"] for child in category_tree[cat_id]["childs"]],
                    category_tree,
                )
            )
    return categories


class CategoryTreeProcessor:
    """Process GPC category tree and generate configuration files"""

    def __init__(self, gpc_file: Path, data_dir: Path):
        self.gpc_file = gpc_file
        self.data_dir = data_dir
        self.data_dir.mkdir(parents=True, exist_ok=True)

        # Load GPC data
        print(f"Loading GPC data from {gpc_file}...")
        with open(gpc_file, "r") as fp:
            self.gpc = json.load(fp)
        print(f"Loaded {len(self.gpc['Schema'])} schemas")

    def process_category_tree(self) -> Dict:
        """Process category tree from GPC data"""
        print("Processing category tree...")
        cattree = {}
        cattree["root"] = {
            "id": "root",
            "name": "root",
            "full_path": [],
            "description": "Top level",
            "childs": [],
        }

        for schema in self.gpc["Schema"]:
            cattree["root"]["childs"].append(
                {
                    "id": str(schema["Code"]),
                    "name": schema["Title"],
                }
            )
            for cat in iterate_category_tree(schema):
                cattree[cat["id"]] = cat

        print(f"Processed {len(cattree)} categories")

        # Save category tree
        output_file = self.data_dir / "labelcats.json"
        with open(output_file, "w") as f:
            json.dump(cattree, f)
        print(f"Saved category tree to {output_file}")

        return cattree

    def process_attributes(self) -> Dict:
        """Process attribute schemas from GPC data"""
        print("Processing attribute schemas...")
        attrs_dict = {}

        for schema in self.gpc["Schema"]:
            attr_dict = build_attribute_dict(schema)
            attrs_dict.update(attr_dict)

        print(f"Processed {len(attrs_dict)} category attribute schemas")

        # Optimize attribute dictionary
        print("Optimizing attribute schemas...")
        linted_attrs_dict = {}
        for code, category_schema in attrs_dict.items():
            linted_attrs_dict[str(code)] = {
                "category_name": category_schema["category"],
                "subcategory_name": category_schema["subcategory"],
                "attributes_schema": optimize_dict(
                    category_schema["attributes_schema"]
                ),
            }

        # Save attribute schemas
        output_file = self.data_dir / "linted_attrs.json"
        with open(output_file, "w") as f:
            json.dump(linted_attrs_dict, f)
        print(f"Saved attribute schemas to {output_file}")

        return linted_attrs_dict


class MetaclassGenerator:
    """Generate metaclasses from category tree"""

    def __init__(
        self,
        category_tree: Dict,
        data_dir: Path,
        singularize_exceptions: Dict = None,
        descriptors: List = None,
        brands: List = None,
        synonyms: Dict = None,
    ):
        self.category_tree = category_tree
        self.data_dir = data_dir
        self.singularize_exceptions = (
            singularize_exceptions or DEFAULT_SINGULARIZE_EXCEPTIONS
        )
        self.descriptors = descriptors or DEFAULT_DESCRIPTORS
        self.brands = brands or []
        self.synonyms = synonyms or DEFAULT_SYNONYMS

        # Import TextCleaner
        try:
            from amzn_smart_product_onboarding_metaclasses.text_cleaner import (
                TextCleaner,
            )

            self.text_cleaner = TextCleaner(
                singularize=self.singularize_exceptions,
                brands=self.brands,
                synonyms=self.synonyms,
                descriptors=self.descriptors,
                language="english",
            )
        except ImportError:
            raise ConfigurationError(
                "Cannot import TextCleaner. Ensure the smart-product-onboarding packages are installed."
            )

    def generate_metaclasses(self) -> Tuple[Dict, Dict, Dict]:
        """Generate metaclasses from category tree"""
        print("Generating metaclasses...")

        # Get leaf categories
        leaf_categories = get_leaf_categories(self.category_tree)
        leaf_df = pd.DataFrame(leaf_categories)
        print(f"Found {len(leaf_df)} leaf categories")

        # Clean category names
        print("Cleaning category names...")
        cleaned_df = leaf_df.copy()
        cleaned_df["clean_name"] = cleaned_df["name"].apply(
            self.text_cleaner.clean_text
        )
        cleaned_df = cleaned_df.dropna()

        # Analyze word frequency
        all_words = " ".join(cleaned_df["clean_name"]).split()
        word_counts = Counter(all_words)
        print(f"Most common words: {word_counts.most_common(10)}")

        # Build word map
        word_map = {}
        for _, cat in cleaned_df.iterrows():
            for word in cat["clean_name"].split():
                if word == "" or word == " " or word == "other":
                    continue
                if word not in word_map:
                    word_map[word] = {cat["id"]}
                else:
                    word_map[word].add(cat["id"])

        print(f"Generated {len(word_map)} unique metaclass words")

        # Create mappings
        mappings_df = cleaned_df[["clean_name", "id"]].rename(
            columns={"clean_name": "name"}
        )

        # Create unique leaves
        unique_leaves = {}
        for word in cleaned_df["clean_name"]:
            if word == "" or word == " " or word == "other":
                continue
            if word not in unique_leaves:
                unique_leaves[word] = 1
            else:
                unique_leaves[word] += 1

        print(f"Generated {len(unique_leaves)} unique leaf category names")

        return word_map, mappings_df, unique_leaves

    def save_metaclasses(
        self, word_map: Dict, mappings_df: pd.DataFrame, unique_leaves: Dict
    ):
        """Save metaclass data to files"""
        print("Saving metaclass data...")

        # Save metaclasses
        df_words = pd.DataFrame(unique_leaves.keys(), columns=["name"])
        output_file = self.data_dir / "metaclasses.json"
        df_words.to_json(output_file)
        print(f"Saved metaclasses to {output_file}")

        # Save mappings
        output_file = self.data_dir / "mappings.json"
        mappings_df.to_json(output_file)
        print(f"Saved mappings to {output_file}")

        # Save word map
        def encode_set(obj):
            if isinstance(obj, set):
                return list(obj)

        output_file = self.data_dir / "word_map.json"
        with open(output_file, "w") as f:
            json.dump(word_map, f, default=encode_set)
        print(f"Saved word map to {output_file}")

        # Save configuration files
        output_file = self.data_dir / "marcas.json"
        with open(output_file, "w") as f:
            json.dump(self.brands, f)

        output_file = self.data_dir / "singularize.json"
        with open(output_file, "w") as f:
            json.dump(self.singularize_exceptions, f)

        output_file = self.data_dir / "descriptors.json"
        with open(output_file, "w") as f:
            json.dump(self.descriptors, f)

        output_file = self.data_dir / "synonyms.json"
        with open(output_file, "w") as f:
            json.dump(self.synonyms, f)

        print("Saved configuration files")


class VectorEmbeddingsProcessor:
    """Process word embeddings and upload to DynamoDB"""

    def __init__(self, word_map: Dict, data_dir: Path):
        self.word_map = word_map
        self.data_dir = data_dir
        self.ddb = boto3.client("dynamodb")
        self.ddbr = boto3.resource("dynamodb")
        self.ssm = boto3.client("ssm")
        self.iam = boto3.client("iam")

        # Get configuration bucket
        self.config_bucket = self.ssm.get_parameter(
            Name=f"{SSM_PREFIX}ConfigurationBucket"
        )["Parameter"]["Value"]
        print(f"Using configuration bucket: {self.config_bucket}")

    def process_embeddings(self) -> Tuple[Dict, faiss.Index, List[str]]:
        """Download, process, and upload word embeddings"""
        print("Processing word embeddings...")

        # Download embeddings
        embeddings_files = get_embeddings_models(
            [DEFAULT_EMBEDDINGS_MODEL_URL], self.data_dir
        )

        # Prepare import directory
        import_dir = self.data_dir / "english_vectors_import"
        import_dir.mkdir(parents=True, exist_ok=True)

        # Process vectors and create import files
        print("Creating DynamoDB import files...")
        file_idx = 0
        vectors_fobj = gzip.open(import_dir / f"vectors_{file_idx}.ion.gz", "wb")
        batch = []
        count = 0

        for model in embeddings_files:
            for item in vector_generator(model):
                batch.append(item)
                if len(batch) >= 1_000:
                    simpleion.dump(
                        batch, vectors_fobj, binary=True, sequence_as_stream=True
                    )
                    count += len(batch)
                    batch = []
                if count >= 100_000:
                    vectors_fobj.close()
                    file_idx += 1
                    vectors_fobj = gzip.open(
                        import_dir / f"vectors_{file_idx}.ion.gz", "wb"
                    )
                    count = 0

        if batch:
            simpleion.dump(batch, vectors_fobj, binary=True, sequence_as_stream=True)
        vectors_fobj.close()

        print(f"Created {file_idx + 1} import files")

        # Upload to S3
        print(f"Uploading vectors to S3...")
        s3 = boto3.client("s3")
        for file in import_dir.glob("*.ion.gz"):
            key = f"english_vectors_import/{file.name}"
            print(f"Uploading {file.name}...")
            s3.upload_file(str(file), self.config_bucket, key)

        print("Upload complete")

        # Import to DynamoDB
        vector_table_name = f"{VECTOR_TABLE_PREFIX}english_vectors"
        print(f"Importing vectors to DynamoDB table: {vector_table_name}")

        job = self.ddb.import_table(
            S3BucketSource={
                "S3Bucket": self.config_bucket,
                "S3KeyPrefix": "english_vectors_import",
            },
            InputFormat="ION",
            InputCompressionType="GZIP",
            TableCreationParameters={
                "TableName": vector_table_name,
                "AttributeDefinitions": [
                    {"AttributeName": "word", "AttributeType": "S"},
                ],
                "KeySchema": [
                    {"AttributeName": "word", "KeyType": "HASH"},
                ],
                "BillingMode": "PAY_PER_REQUEST",
            },
        )

        # Wait for import to complete
        import_arn = job["ImportTableDescription"]["ImportArn"]
        print("Waiting for DynamoDB import to complete...")
        while True:
            job_status = self.ddb.describe_import(ImportArn=import_arn)
            status = job_status["ImportTableDescription"]["ImportStatus"]
            if status != "IN_PROGRESS":
                break
            print(f"Import status: {status}")
            time.sleep(60)

        print(f"Import complete with status: {status}")

        if status != "COMPLETED":
            raise ConfigurationError(f"DynamoDB import failed with status: {status}")

        # Build category vectors
        print("Building category vectors...")
        vector_table = self.ddbr.Table(vector_table_name)
        category_vectors = self._build_category_vectors(vector_table)

        # Build FAISS index
        print("Building FAISS index...")
        word_index, faiss_index = self._build_faiss_index(category_vectors)

        # Update IAM policy
        print("Updating IAM policy for word embeddings access...")
        self._update_iam_policy(vector_table.table_arn)

        # Clean up S3 import files
        print("Cleaning up S3 import files...")
        for file in import_dir.glob("*.ion.gz"):
            key = f"english_vectors_import/{file.name}"
            s3.delete_object(Bucket=self.config_bucket, Key=key)

        return category_vectors, faiss_index, word_index

    def _build_category_vectors(self, vector_table) -> Dict:
        """Build category vectors from word embeddings"""
        category_vectors = {}
        batch = []
        vector_table_name = vector_table.name

        for w in self.word_map.keys():
            batch.append(w)
            if len(batch) == 100:
                result = self.ddb.batch_get_item(
                    RequestItems={
                        vector_table_name: {
                            "Keys": [{"word": {"S": word}} for word in batch]
                        }
                    },
                )
                for item in result["Responses"][vector_table_name]:
                    word = item["word"]["S"]
                    vector = [float(v["N"]) for v in item["vector"]["L"]]
                    category_vectors[word] = vector
                batch = []

        if batch:
            result = self.ddb.batch_get_item(
                RequestItems={
                    vector_table_name: {
                        "Keys": [{"word": {"S": word}} for word in batch]
                    }
                },
            )
            for item in result["Responses"][vector_table_name]:
                word = item["word"]["S"]
                vector = [float(v["N"]) for v in item["vector"]["L"]]
                category_vectors[word] = vector

        print(
            f"Built vectors for {len(category_vectors)}/{len(self.word_map)} category words"
        )
        return category_vectors

    def _build_faiss_index(
        self, category_vectors: Dict
    ) -> Tuple[List[str], faiss.Index]:
        """Build FAISS index from category vectors"""
        word_index = list(category_vectors.keys())
        d = len(next(iter(category_vectors.values())))

        index = faiss.index_factory(d, "Flat", faiss.METRIC_INNER_PRODUCT)
        index_array = np.array([v for v in category_vectors.values()]).astype(
            np.float32
        )
        faiss.normalize_L2(index_array)
        index.add(index_array)

        print(f"Built FAISS index with {index.ntotal} vectors")
        return word_index, index

    def _update_iam_policy(self, table_arn: str):
        """Update IAM policy to grant read access to the embeddings table"""
        try:
            word_embeddings_policy_arn = self.ssm.get_parameter(
                Name=f"{SSM_PREFIX}WordEmbeddingsPolicyArn"
            )["Parameter"]["Value"]

            self.iam.create_policy_version(
                PolicyArn=word_embeddings_policy_arn,
                PolicyDocument=json.dumps(
                    {
                        "Version": "2012-10-17",
                        "Statement": [
                            {
                                "Sid": "wordembeddings",
                                "Effect": "Allow",
                                "Action": [
                                    "dynamodb:GetItem",
                                    "dynamodb:BatchGetItem",
                                    "dynamodb:Scan",
                                    "dynamodb:Query",
                                    "dynamodb:ConditionCheckItem",
                                ],
                                "Resource": table_arn,
                            }
                        ],
                    }
                ),
                SetAsDefault=True,
            )
            print("Updated IAM policy successfully")
        except Exception as e:
            print(f"Warning: Could not update IAM policy: {e}")

    def save_category_vectors(self, category_vectors: Dict):
        """Save category vectors to file"""
        output_file = self.data_dir / "category_vectors.json"
        with open(output_file, "w") as f:
            json.dump(category_vectors, f)
        print(f"Saved category vectors to {output_file}")


def upload_to_s3(data_dir: Path, config_bucket: str, files: List[str]):
    """Upload configuration files to S3"""
    print(f"Uploading configuration files to S3 bucket: {config_bucket}")
    s3 = boto3.client("s3")

    for filename in files:
        file_path = data_dir / filename
        if file_path.exists():
            key = f"data/{filename}"
            print(f"Uploading {filename}...")
            s3.upload_file(str(file_path), config_bucket, key)
        else:
            print(f"Warning: {filename} not found, skipping")

    print("Upload complete")


def save_ssm_configuration(vector_table_name: str):
    """Save configuration to SSM Parameter Store"""
    print("Saving configuration to SSM Parameter Store...")
    ssm = boto3.client("ssm")

    config = {
        "language": "english",
        "wordEmbeddingsTable": vector_table_name,
        "categoryTree": "data/labelcats.json",
        "metaclasses": "data/metaclasses.json",
        "mappings": "data/mappings.json",
        "categoryVectors": "data/category_vectors.json",
        "wordMap": "data/word_map.json",
        "brands": "data/marcas.json",
        "singularize": "data/singularize.json",
        "synonyms": "data/synonyms.json",
        "descriptors": "data/descriptors.json",
        "alwaysCategories": "data/always.json",
    }

    ssm.put_parameter(
        Name=f"{SSM_PREFIX}CategorizationConfig",
        Value=json.dumps(config),
        Type="String",
        Overwrite=True,
    )

    print(f"Saved configuration to {SSM_PREFIX}CategorizationConfig")


def generate_always_categories(category_tree: Dict, data_dir: Path):
    """Generate list of categories to always include (media categories)"""
    print("Generating always-include categories...")
    always_categories = get_child_category_ids(ALWAYS_CATEGORY_IDS, category_tree)

    output_file = data_dir / "always.json"
    with open(output_file, "w") as f:
        json.dump(always_categories, f)

    print(f"Generated {len(always_categories)} always-include categories")
    return always_categories


def main():
    """Main execution function"""
    parser = argparse.ArgumentParser(
        description="Configure Smart Product Onboarding categorization system",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic usage with GPC file
  python configure_categorization.py --gpc-file data/GPC.json
  
  # Skip embeddings processing (if already done)
  python configure_categorization.py --gpc-file data/GPC.json --skip-embeddings
        """,
    )

    parser.add_argument(
        "--gpc-file",
        type=Path,
        required=True,
        help="Path to GPC JSON file (download from https://gpc-browser.gs1.org/)",
    )

    parser.add_argument(
        "--data-dir",
        type=Path,
        default=Path("data"),
        help="Directory for data files (default: data/)",
    )

    parser.add_argument(
        "--skip-embeddings",
        action="store_true",
        help="Skip word embeddings processing (use if already configured)",
    )

    parser.add_argument(
        "--skip-upload",
        action="store_true",
        help="Skip uploading files to S3 (for testing)",
    )

    args = parser.parse_args()

    # Validate GPC file exists
    if not args.gpc_file.exists():
        print(f"Error: GPC file not found: {args.gpc_file}")
        print("\nDownload the GPC file from: https://gpc-browser.gs1.org/")
        sys.exit(1)

    try:
        # Step 1: Process category tree
        print("\n" + "=" * 60)
        print("STEP 1: Processing Category Tree")
        print("=" * 60 + "\n")

        processor = CategoryTreeProcessor(args.gpc_file, args.data_dir)
        category_tree = processor.process_category_tree()
        attrs_dict = processor.process_attributes()

        # Step 2: Generate metaclasses
        print("\n" + "=" * 60)
        print("STEP 2: Generating Metaclasses")
        print("=" * 60 + "\n")

        generator = MetaclassGenerator(category_tree, args.data_dir)
        word_map, mappings_df, unique_leaves = generator.generate_metaclasses()
        generator.save_metaclasses(word_map, mappings_df, unique_leaves)

        # Step 3: Generate always-include categories
        print("\n" + "=" * 60)
        print("STEP 3: Generating Always-Include Categories")
        print("=" * 60 + "\n")

        always_categories = generate_always_categories(category_tree, args.data_dir)

        # Step 4: Process word embeddings
        vector_table_name = f"{VECTOR_TABLE_PREFIX}english_vectors"

        if not args.skip_embeddings:
            print("\n" + "=" * 60)
            print("STEP 4: Processing Word Embeddings")
            print("=" * 60 + "\n")
            print(
                "WARNING: This step may take 30-60 minutes and will download ~1GB of data"
            )

            embeddings_processor = VectorEmbeddingsProcessor(word_map, args.data_dir)
            category_vectors, faiss_index, word_index = (
                embeddings_processor.process_embeddings()
            )
            embeddings_processor.save_category_vectors(category_vectors)
        else:
            print("\n" + "=" * 60)
            print("STEP 4: Skipping Word Embeddings (--skip-embeddings)")
            print("=" * 60 + "\n")

        # Step 5: Upload to S3
        if not args.skip_upload:
            print("\n" + "=" * 60)
            print("STEP 5: Uploading Configuration to S3")
            print("=" * 60 + "\n")

            ssm = boto3.client("ssm")
            config_bucket = ssm.get_parameter(Name=f"{SSM_PREFIX}ConfigurationBucket")[
                "Parameter"
            ]["Value"]

            files_to_upload = [
                "labelcats.json",
                "linted_attrs.json",
                "metaclasses.json",
                "mappings.json",
                "word_map.json",
                "category_vectors.json",
                "marcas.json",
                "singularize.json",
                "synonyms.json",
                "descriptors.json",
                "always.json",
            ]

            upload_to_s3(args.data_dir, config_bucket, files_to_upload)

            # Upload attributes schema with specific name
            s3 = boto3.client("s3")
            s3.upload_file(
                str(args.data_dir / "linted_attrs.json"),
                config_bucket,
                "data/attributes_schema.json",
            )
            print("Uploaded attributes_schema.json")
        else:
            print("\n" + "=" * 60)
            print("STEP 5: Skipping S3 Upload (--skip-upload)")
            print("=" * 60 + "\n")

        # Step 6: Save SSM configuration
        if not args.skip_upload:
            print("\n" + "=" * 60)
            print("STEP 6: Saving SSM Configuration")
            print("=" * 60 + "\n")

            save_ssm_configuration(vector_table_name)

        # Success message
        print("\n" + "=" * 60)
        print("CONFIGURATION COMPLETE!")
        print("=" * 60)
        print(
            "\nThe Smart Product Onboarding system is now configured and ready to use."
        )
        print(f"\nConfiguration files saved to: {args.data_dir}")
        if not args.skip_upload:
            print(f"Configuration uploaded to S3 bucket: {config_bucket}")
            print(f"SSM Parameter: {SSM_PREFIX}CategorizationConfig")

    except ConfigurationError as e:
        print(f"\nConfiguration Error: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"\nUnexpected Error: {e}", file=sys.stderr)
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
