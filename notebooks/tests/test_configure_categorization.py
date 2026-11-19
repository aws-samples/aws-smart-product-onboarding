# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import sys
from pathlib import Path
from unittest.mock import MagicMock

import boto3
import pytest
from botocore.stub import Stubber

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import configure_categorization as cc  # noqa: E402
from amzn_smart_product_onboarding_metaclasses.text_cleaner import TextCleaner  # noqa: E402

TABLE = f"{cc.VECTOR_TABLE_PREFIX}english_vectors"


def _node(level, code, title, childs=None):
    return {
        "Level": level,
        "Code": code,
        "Title": title,
        "Definition": f"{title} definition",
        "DefinitionExcludes": None,
        "Active": True,
        "Childs": childs or [],
    }


def _processor(table_status):
    """A VectorEmbeddingsProcessor with a stubbed DynamoDB client and no other AWS calls."""
    processor = cc.VectorEmbeddingsProcessor.__new__(cc.VectorEmbeddingsProcessor)
    processor.word_map = {"skate": ["10008489"], "asbestos": ["10008511"]}
    processor.data_dir = Path(".")
    processor.config_bucket = "bucket"
    processor.ddb = boto3.client(
        "dynamodb", region_name="us-east-1", aws_access_key_id="testing", aws_secret_access_key="testing"
    )
    processor.ddbr = MagicMock()
    processor.ssm = MagicMock()
    processor.iam = MagicMock()
    stubber = Stubber(processor.ddb)
    if table_status is None:
        stubber.add_client_error("describe_table", "ResourceNotFoundException", expected_params={"TableName": TABLE})
    else:
        stubber.add_response("describe_table", {"Table": {"TableStatus": table_status}}, {"TableName": TABLE})
    stubber.activate()
    return processor


def test_existing_active_table_is_reused_and_category_vectors_rebuilt(monkeypatch):
    processor = _processor("ACTIVE")
    processor._import_vectors = MagicMock()
    processor._build_category_vectors = MagicMock(return_value={"skate": [1.0, 0.0], "asbestos": [0.0, 1.0]})

    category_vectors, index, word_index = processor.process_embeddings()

    processor._import_vectors.assert_not_called()
    processor._build_category_vectors.assert_called_once_with(processor.ddbr.Table.return_value)
    processor.ddbr.Table.assert_called_once_with(TABLE)
    assert set(category_vectors) == {"skate", "asbestos"}
    assert index.ntotal == 2


def test_missing_table_is_imported():
    processor = _processor(None)
    processor._import_vectors = MagicMock()
    processor._build_category_vectors = MagicMock(return_value={"skate": [1.0, 0.0]})

    processor.process_embeddings()

    processor._import_vectors.assert_called_once_with(TABLE)


def test_table_that_is_not_active_raises():
    processor = _processor("CREATING")
    processor._import_vectors = MagicMock()

    with pytest.raises(cc.ConfigurationError, match="CREATING"):
        processor.process_embeddings()
    processor._import_vectors.assert_not_called()


def _policy_processor(current_resource):
    processor = cc.VectorEmbeddingsProcessor.__new__(cc.VectorEmbeddingsProcessor)
    processor.ssm = MagicMock()
    processor.ssm.get_parameter.return_value = {"Parameter": {"Value": "policy-arn"}}
    processor.iam = MagicMock()
    processor.iam.get_policy.return_value = {"Policy": {"DefaultVersionId": "v2"}}
    statement = {
        "Sid": "wordembeddings",
        "Effect": "Allow",
        "Action": ["dynamodb:GetItem", "dynamodb:BatchGetItem", "dynamodb:Scan", "dynamodb:Query", "dynamodb:ConditionCheckItem"],
        "Resource": current_resource,
    }
    processor.iam.get_policy_version.return_value = {
        "PolicyVersion": {"Document": {"Version": "2012-10-17", "Statement": [statement]}}
    }
    return processor


def test_policy_version_is_not_added_when_access_is_unchanged():
    processor = _policy_processor("table-arn")

    processor._update_iam_policy("table-arn")

    processor.iam.create_policy_version.assert_not_called()


def test_policy_version_is_added_for_a_new_table():
    processor = _policy_processor("other-table-arn")

    processor._update_iam_policy("table-arn")

    document = cc.json.loads(processor.iam.create_policy_version.call_args.kwargs["PolicyDocument"])
    assert document["Statement"][0]["Resource"] == "table-arn"


def test_policy_version_is_added_when_the_current_policy_cannot_be_read():
    processor = _policy_processor("table-arn")
    processor.iam.get_policy.side_effect = Exception("AccessDenied")

    processor._update_iam_policy("table-arn")

    processor.iam.create_policy_version.assert_called_once()


def _deployed(monkeypatch, word_map):
    s3 = boto3.client("s3", region_name="us-east-1", aws_access_key_id="testing", aws_secret_access_key="testing")
    stubber = Stubber(s3)
    if word_map is None:
        stubber.add_client_error("get_object", "NoSuchKey")
    else:
        stubber.add_response("get_object", {"Body": cc.io.BytesIO(cc.json.dumps(word_map).encode())})
        stubber.add_response("head_object", {})
    stubber.activate()
    monkeypatch.setattr(cc.boto3, "client", lambda *a, **k: s3)


def test_skip_embeddings_keeps_vectors_when_category_words_match(tmp_path, monkeypatch):
    _write_config(tmp_path, always=["10"])
    _deployed(monkeypatch, {"lamp": ["10"]})

    cc.check_deployed_category_words(tmp_path, "bucket")


def test_skip_embeddings_fails_when_category_words_changed(tmp_path, monkeypatch):
    _write_config(tmp_path, always=["10"])
    _deployed(monkeypatch, {"lamp": ["10"], "bassinet": ["10"]})

    with pytest.raises(cc.ConfigurationError, match="removed: bassinet"):
        cc.check_deployed_category_words(tmp_path, "bucket")


def test_skip_embeddings_fails_without_deployed_vectors(tmp_path, monkeypatch):
    _write_config(tmp_path, always=["10"])
    _deployed(monkeypatch, None)

    with pytest.raises(cc.ConfigurationError, match="No deployed category vectors"):
        cc.check_deployed_category_words(tmp_path, "bucket")


def test_missing_always_category_raises(tmp_path):
    tree = {cat_id: {"childs": []} for cat_id in cc.ALWAYS_CATEGORY_IDS[1:]}

    with pytest.raises(cc.ConfigurationError, match=cc.ALWAYS_CATEGORY_IDS[0]):
        cc.generate_always_categories(tree, tmp_path)


def _write_config(path, always, vectors=None):
    tree = {
        "root": {"id": "root", "childs": [{"id": "1"}]},
        "1": {"id": "1", "childs": [{"id": "10"}]},
        "10": {"id": "10", "childs": []},
    }
    files = {
        "labelcats.json": tree,
        "always.json": always,
        "word_map.json": {"lamp": ["10"]},
        "mappings.json": {"name": {"0": "lamp"}, "id": {"0": "10"}},
        "linted_attrs.json": {"10": {}},
    }
    if vectors is not None:
        files["category_vectors.json"] = vectors
    for name, content in files.items():
        (path / name).write_text(cc.json.dumps(content))


def test_consistent_configuration_passes(tmp_path):
    _write_config(tmp_path, always=["10"], vectors={"lamp": [1.0]})

    cc.validate_configuration(tmp_path)


def test_always_category_from_another_release_fails(tmp_path):
    _write_config(tmp_path, always=["10", "10008494"])

    with pytest.raises(cc.ConfigurationError, match="always.json: 10008494"):
        cc.validate_configuration(tmp_path)


def test_category_vectors_from_another_release_fail(tmp_path):
    _write_config(tmp_path, always=["10"], vectors={"lamp": [1.0], "bassinet": [0.5]})

    with pytest.raises(cc.ConfigurationError, match="bassinet"):
        cc.validate_configuration(tmp_path)


def test_skip_embeddings_ignores_local_category_vectors(tmp_path):
    _write_config(tmp_path, always=["10"], vectors={"lamp": [1.0], "bassinet": [0.5]})

    cc.validate_configuration(tmp_path, check_vectors=False)


@pytest.mark.parametrize(
    "gpc",
    [[], {}, {"Schema": []}, {"Schema": [{"Code": 1, "Title": "x"}]}],
)
def test_unexpected_gpc_format_raises(gpc):
    with pytest.raises(cc.ConfigurationError, match="Unexpected GPC file format"):
        cc.validate_gpc(gpc)


def test_gpc_tree_is_parsed():
    gpc = {"Schema": [_node(1, 14000000, "Lighting", [_node(2, 14010000, "Lighting", [_node(3, 14010100, "Lamps", [_node(4, 10008494, "Lamp", [_node(5, 20000001, "Colour")])])])])]}
    cc.validate_gpc(gpc)

    tree = {cat["id"]: cat for cat in cc.iterate_category_tree(gpc["Schema"][0])}

    assert set(tree) == {"14000000", "14010000", "14010100", "10008494"}
    assert tree["10008494"]["childs"] == []
    assert [p["id"] for p in tree["10008494"]["full_path"]] == ["14000000", "14010000", "14010100", "10008494"]


@pytest.mark.parametrize(
    "title, expected",
    [
        ("Asbestos Management", "asbestos management"),
        ("Blu-ray", "blu ray"),
    ],
)
def test_singularize_exceptions(title, expected):
    cleaner = TextCleaner(
        singularize=cc.DEFAULT_SINGULARIZE_EXCEPTIONS,
        synonyms=cc.DEFAULT_SYNONYMS,
        descriptors=cc.DEFAULT_DESCRIPTORS,
    )

    assert cleaner.clean_text(title) == expected
