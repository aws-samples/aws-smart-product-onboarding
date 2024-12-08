# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0


def json_to_xml(json_obj, line_padding=""):
    """Recursively convert JSON object to XML string."""
    result_list = []

    if isinstance(json_obj, dict):
        for tag_name, sub_obj in json_obj.items():
            result_list.append(f"{line_padding}<{tag_name}>")
            result_list.append(json_to_xml(sub_obj, line_padding + "  "))
            result_list.append(f"{line_padding}</{tag_name}>")
    elif isinstance(json_obj, list):
        for sub_obj in json_obj:
            result_list.append(json_to_xml(sub_obj, line_padding))
    else:
        result_list.append(f"{line_padding}{json_obj}")

    return "\n".join(result_list)
