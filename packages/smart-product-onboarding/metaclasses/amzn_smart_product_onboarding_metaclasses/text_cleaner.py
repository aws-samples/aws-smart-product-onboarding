# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import inflect
from typing import Sequence

import re

import nltk
import os

from amzn_smart_product_onboarding_core_utils.logger import logger

logger.name = "TextCleaner"

if not os.getenv("AWS_LAMBDA_FUNCTION_NAME"):
    nltk.download("stopwords")
    nltk.download("punkt")
    nltk.download("punkt_tab")


class TextCleaner:
    def __init__(
        self,
        singularize: dict[str, str] = None,
        brands: list[str] = None,
        synonyms: dict[str, str] = None,
        descriptors: list[str] = None,
        language: str = "english",
    ):
        self.language = language
        self.singularize = singularize if singularize is not None else {}
        self.brands = brands if brands is not None else []
        self.synonyms = synonyms if synonyms is not None else {}
        self.descriptors = descriptors if descriptors is not None else []

    def clean_text(self, text: str):
        logger.info(f"Clean text start")
        text = text.lower()
        logger.debug(f"lowercase {text}")
        text = self._replace_re(text)
        logger.debug(f"no special characters {text}")
        text = self._remove_brands(text)
        logger.debug(f"removed brands  {text}")
        text = self._remove_packages(text)
        logger.debug(f"removed packages {text}")
        text = self._remove_dimensions(text)
        logger.debug(f"removed dimensions {text}")
        text = self._remove_html_tags(text)
        logger.debug(f"removed html tags {text}")
        text = self._replace_direct(text)
        logger.debug(f"acronyms replacing {text}")
        # Replace numbers or weird patterns in title like model names eg: WZ500
        text = re.sub(r"/[a-z]\d|\d[a-z]*", r"", text)
        text = re.sub(r"[^a-zA-Z0-9_áéíóúñ ]", r"", text)
        logger.debug(f"model series and other numbers {text}")
        s = []
        for word in text.split():
            parts = self._split_plants(word)
            for part in parts:
                part = self._singularize_word(part)
                part = self._replace_synonyms(part)
                s.append(part)
        text = " ".join(s)
        logger.debug(f"singular {text}")
        text = self._remove_descriptors(text)
        logger.debug(f"removed descriptors {text}")
        text = self._remove_stopwords_tokenize_text(text)
        logger.debug(f"removed stopwords {text}")
        logger.info(f"Clean text end")
        return text

    def _replace_direct(self, value: str):
        acronyms = {
            "a/c": "air conditioner",
            "/": " ",
            "-": " ",
            "others": "",
            "other": "",
        }

        for k in acronyms:
            value = value.replace(k, acronyms[k])

        return value.replace("  ", " ").strip()

    def _replace_re(self, text: str):
        rules = [
            [r"[p|P]arámetro por [o|O]misión", ""],
            [r"[r|R]eady to [w|W]ear", ""],
            [r"variety pack", ""],
            [r"\(.*\)", ""],
            [r"  +", " "],
        ]

        for rule in rules:
            text = re.sub(rule[0], rule[1], text)

        accent_replacements = [
            ["á", "a"],
            ["é", "e"],
            ["í", "i"],
            ["ó", "o"],
            ["ú", "u"],
            ["ü", "u"],
            ["√©", "e"],
            ["√≥", "o"],
            ["√≠", "i"],
            ["√±", "ñ"],
            ["√°", "a"],
            ["√∫", "u"],
        ]

        for replacement in accent_replacements:
            text = text.replace(replacement[0], replacement[1])

        return text.strip()

    def _split_plants(self, word: str) -> Sequence[str]:
        # Split word into a sequence of the base word and the
        # suffix if it ends in one of the following suffixes
        suffixes = ["ferns", "grass", "plants", "trees", "shrubs"]
        for suffix in suffixes:
            if word.endswith(suffix):
                return [word[: -len(suffix)], suffix]
        return [word]

    # adapted from https://github.com/bermi/Python-Inflector
    def _singularize_word(self, word: str) -> str:
        if word.endswith("ss"):
            return word
        if word in self.singularize:
            return self.singularize.get(word, word)

        try:
            inflector = inflect.engine()
            noun = inflector.singular_noun(word)
            if noun:
                return str(noun)
            else:
                return word
        except:
            return word

    def _remove_descriptors(self, sentence: str) -> str:
        return " ".join((word for word in sentence.split() if word not in self.descriptors))

    def _remove_stopwords_tokenize_text(self, text: str):
        stopwords = nltk.corpus.stopwords.words(self.language)
        tokens = nltk.tokenize.word_tokenize(text)
        non_stopwords = [w for w in tokens if not w.lower() in stopwords]
        return " ".join(non_stopwords)

    def _remove_html_tags(self, text: str):
        regex_html_tags = r"\<(?:\"[^\"]*\"['\"]*|'[^']*'['\"]*|[^'\">])+\>"
        return re.sub(regex_html_tags, "", text)

    def _remove_packages(self, text: str):
        regex_packages = r"pack (x\d*|\d*)"
        str_output = re.sub(regex_packages, "", text)
        return str_output.replace("  ", " ").strip()

    def _remove_dimensions(self, text: str):
        regex_dimensions = r"\d*(x| x )\d*"
        str_output = re.sub(regex_dimensions, "", text)
        return str_output.replace("  ", " ").strip()

    def _remove_brands(self, text: str):
        for brand in self.brands:
            text = re.sub(r"\b" + re.escape(brand.lower()) + r"\b", "", text)
        return text

    def _replace_synonyms(self, word: str):
        return self.synonyms.get(word, word)
