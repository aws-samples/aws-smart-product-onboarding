# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

from typing import Any
import re
from lxml import etree  # nosec - B410: lxml is needed to parse partial XML. The XML is generated by an LLM


def xml_to_dict(element: etree._Element) -> dict[str, Any] | list[Any] | str:
    if len(element) == 0:
        return {element.tag: element.text if element.text else ""}

    result = {element.tag: {}}
    for child in element:
        child_result = xml_to_dict(child)
        if child.tag in result[element.tag]:
            if not isinstance(result[element.tag][child.tag], list):
                result[element.tag][child.tag] = [result[element.tag][child.tag]]
            result[element.tag][child.tag].append(child_result[child.tag])
        else:
            result[element.tag].update(child_result)
    return result


def parse_response(xml_string: str, cdata_tags: list[str] = None) -> dict[str, Any]:
    """Parse possibly partial XML into a nested data structure of dicts and lists.
    :param xml_string : The XML string to parse
    :param cdata_tags : A list of tag names with content that may contain XML tags that shouldn't get parsed.
    """
    cdata_tags = cdata_tags if cdata_tags else []
    # Wrap the content of specified tags in CDATA sections using regex
    for tag in cdata_tags:
        pattern = f"<{tag}>(.+?)</{tag}>"
        replacement = f"<{tag}><![CDATA[\\1]]></{tag}>"
        xml_string = re.sub(pattern, replacement, xml_string, flags=re.DOTALL)

    # Create a parser that doesn't resolve entities
    parser = etree.XMLParser(resolve_entities=False)

    # Parse the XML
    try:
        root = etree.fromstring(xml_string.encode("utf-8"), parser=parser)  # nosec - B320: XML comes from LLM output
    except etree.XMLSyntaxError:
        # If parsing fails, try wrapping with a root element
        try:
            root = etree.fromstring(  # nosec - B320: XML comes from LLM output
                f"<root>{xml_string}</root>".encode("utf-8"), parser=parser
            )
        except etree.XMLSyntaxError as e:
            raise ValueError(f"Invalid XML: {str(e)}")

    # Convert the XML structure to a dictionary
    response_dict = xml_to_dict(root)

    # Remove the extra 'root' key if it was added
    if root.tag == "root" and not xml_string.strip().startswith("<root>"):
        response_dict = response_dict["root"]

    return response_dict