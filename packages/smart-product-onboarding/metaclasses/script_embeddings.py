# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
import sys

from gensim.models.keyedvectors import KeyedVectors
import os
import shutil
import tempfile
import hashlib
from urllib.request import urlretrieve
import zipfile

CACHE_DIR = os.getenv("CACHE_DIR")
if not CACHE_DIR:
    tempdir = tempfile.TemporaryDirectory()
    CACHE_DIR = tempdir.name
EMBEDDINGS_MODEL_URL = os.getenv("EMBEDDINGS_MODEL_URL")
if not EMBEDDINGS_MODEL_URL:
    raise Exception("EMBEDDINGS_MODEL_URL not set")
if not EMBEDDINGS_MODEL_URL.startswith("https://"):
    raise Exception("EMBEDDINGS_MODEL_URL must start with https://")
NEW_WORDVECTORS_FILE_VEC = "small_embeddings-model.vec"

tmpdirname = os.path.join(CACHE_DIR, hashlib.md5(EMBEDDINGS_MODEL_URL.encode(), usedforsecurity=False).hexdigest())
vecfile_basename = os.path.basename(EMBEDDINGS_MODEL_URL)
compressed_vectors_cached = os.path.join(tmpdirname, "compressed", NEW_WORDVECTORS_FILE_VEC)
compressed_vectors_npy_cached = compressed_vectors_cached + ".vectors.npy"


def validate_compressed_embeddings(vec_file, npy_file, dest_dir):
    print("Testing loading compressed embeddings")
    try:
        new_wordvectors = KeyedVectors.load(vec_file, mmap="r")
    except Exception as e:
        print(f"ERROR: Failed opening or loading new Keyedvectors file {vec_file}")
        print(e)
        return False
    print("Copying from cache")
    try:
        shutil.copy(vec_file, dest_dir)
        shutil.copy(npy_file, dest_dir)
    except Exception as e:
        print(f"ERROR: Failed copying files to {dest_dir}")
        print(e)
        return False
    return True


if os.path.exists(compressed_vectors_cached) and os.path.exists(compressed_vectors_npy_cached):
    if validate_compressed_embeddings(compressed_vectors_cached, compressed_vectors_npy_cached, os.getcwd()):
        print("Cached embeddings loaded, validated, and copied")
        sys.exit()
    else:
        print("Cached embeddings failed validation. Falling back.")

if not os.path.exists(os.path.join(tmpdirname, vecfile_basename)):
    os.makedirs(tmpdirname, exist_ok=True)
    print(f"Downloading embeddings {EMBEDDINGS_MODEL_URL}")
    # nosemgrep: dynamic-urllib-use-detected
    urlretrieve(EMBEDDINGS_MODEL_URL, os.path.join(tmpdirname, vecfile_basename))
    print(f"Downloaded embeddings {EMBEDDINGS_MODEL_URL}")
else:
    print(f"Embeddings {EMBEDDINGS_MODEL_URL} already in cache")
if vecfile_basename.endswith(".zip"):
    if not os.path.exists(os.path.join(tmpdirname, vecfile_basename.replace(".zip", ""))):
        print(f"Extracting embeddings {EMBEDDINGS_MODEL_URL}")
        with zipfile.ZipFile(os.path.join(tmpdirname, vecfile_basename), "r") as zip_ref:
            zip_ref.extractall(tmpdirname)
        print(f"Extracted embeddings {EMBEDDINGS_MODEL_URL}")
        EMBEDDINGS_MODEL = os.path.join(tmpdirname, vecfile_basename.replace(".zip", ""))
    else:
        print(f"Embeddings {EMBEDDINGS_MODEL_URL} already extracted")
        EMBEDDINGS_MODEL = os.path.join(tmpdirname, vecfile_basename.replace(".zip", ""))
elif vecfile_basename.endswith(".vec"):
    EMBEDDINGS_MODEL = os.path.join(tmpdirname, vecfile_basename)

compressed_vectors_cached = os.path.join(tmpdirname, "compressed", NEW_WORDVECTORS_FILE_VEC)
compressed_vectors_npy_cached = compressed_vectors_cached + ".vectors.npy"
if not (os.path.exists(compressed_vectors_cached) and os.path.exists(compressed_vectors_npy_cached)):
    os.makedirs(os.path.join(tmpdirname, "compressed"), exist_ok=True)
    print(f"Loading embeddings {EMBEDDINGS_MODEL}")
    wordvectors = KeyedVectors.load_word2vec_format(EMBEDDINGS_MODEL)
    print(f"Embeddings {EMBEDDINGS_MODEL} loaded")
    print(f"Compressing embeddings {EMBEDDINGS_MODEL} into {NEW_WORDVECTORS_FILE_VEC}")
    try:
        wordvectors.save(compressed_vectors_cached)
    except Exception as e:
        print(f"ERROR: Failed saving file ")
        print(e)
        raise Exception(f"ERROR: Failed saving file ")
else:
    print(f"Embeddings {EMBEDDINGS_MODEL} already compressed")


if os.path.exists(compressed_vectors_cached):
    validate_compressed_embeddings(compressed_vectors_cached, compressed_vectors_npy_cached, os.getcwd())
else:
    print(f"The file {compressed_vectors_cached} does not exist")
    raise Exception(f"The file {compressed_vectors_cached} does not exist")
