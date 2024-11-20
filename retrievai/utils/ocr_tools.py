from typing import List
import re
from functools import lru_cache
from threading import Lock
import logging

logger = logging.getLogger(__name__)

class OCRCleanupPipeline:
    def __init__(self):
        """Initialize the OCR cleanup pipeline with lazy loading."""
        self._tokenizer = None
        self._tokenizer_lock = Lock()
        self._wordsegment_loaded = False
        self._wordsegment_lock = Lock()

    @property
    @lru_cache(maxsize=1)
    def tokenizer(self):
        """Lazy load NLTK tokenizer."""
        if self._tokenizer is None:
            with self._tokenizer_lock:
                if self._tokenizer is None:  # Double-check pattern
                    import nltk
                    try:
                        nltk.data.find('tokenizers/punkt')
                    except LookupError:
                        nltk.download('punkt')
                    from nltk.tokenize import TreebankWordTokenizer
                    self._tokenizer = TreebankWordTokenizer()
        return self._tokenizer

    def _ensure_wordsegment(self):
        """Lazy load wordsegment."""
        if not self._wordsegment_loaded:
            with self._wordsegment_lock:
                if not self._wordsegment_loaded:  # Double-check pattern
                    from wordsegment import load
                    load()
                    self._wordsegment_loaded = True

    @staticmethod
    def _clean_token_for_segmentation(token: str) -> str:
        """Remove punctuation for segmentation while preserving structure."""
        return ''.join(char for char in token if char.isalnum() or char == '/')

    @staticmethod
    def _reintroduce_punctuation(original: str, segments: List[str]) -> List[str]:
        """Re-introduce punctuation into segmented tokens."""
        result = []
        pos = 0
        for segment in segments:
            while pos < len(original) and not original[pos].isalnum() and original[pos] != '/':
                result.append(original[pos])
                pos += 1
            result.append(segment)
            pos += len(segment)
        while pos < len(original):
            result.append(original[pos])
            pos += 1
        return result

    def restore_whitespace(self, text: str) -> str:
        """
        Restore whitespace using lazy-loaded NLTK and wordsegment.
        Only loads required components when needed.
        """
        if not self.needs_whitespace_restoration(text):
            return text

        # Get initial tokens using NLTK (lazy loaded)
        spans = list(self.tokenizer.span_tokenize(text))
        tokens = [text[start:end] for start, end in spans]

        # Process tokens
        processed_tokens = []
        for token in tokens:
            if re.match(r'https?://|www\.', token) or '/' in token:
                # Preserve links and paths
                processed_tokens.append(token)
            if len(token) >= 10:
                cleaned_token = self._clean_token_for_segmentation(token)
                if cleaned_token:  # Skip empty tokens
                    self._ensure_wordsegment()
                    segments = self.segment_preserve_case(cleaned_token)
                    segments_with_punctuation = self._reintroduce_punctuation(token, segments)
                    processed_tokens.extend(segments_with_punctuation)
            else:
                processed_tokens.append(token)

        # Join tokens with proper spacing
        result = ""
        for i, token in enumerate(processed_tokens):
            if i > 0:
                prev_token = processed_tokens[i - 1]

                # Avoid spaces after opening brackets
                if prev_token in "([{":
                    pass
                # Avoid spaces before closing brackets
                elif token in ")]}":
                    pass
                # Ensure proper spacing before opening brackets
                elif token.startswith("(") and not prev_token.endswith((" ", ".", ",", "-", "/")):
                    result += " "
                # General spacing rules
                elif token not in ".,!?;:')]}-/\"" and not token.startswith(("'", "\"")):
                    result += " "

            # Append current token
            result += token

        return result.strip().strip("`- ")

    @staticmethod
    def needs_whitespace_restoration(text: str) -> bool:
        """
        Check if text needs whitespace restoration.
        This method doesn't require any loaded models.
        """
        # Check for very long words
        if any(len(word) >= 20 for word in text.split()):
            return True

        # Check for common OCR issues
        patterns = [
            r'[a-z][A-Z]',  # Mixed case with no space
            r'\w[.,!?]\w',  # No spaces around punctuation
            r'[A-Z]{2,}[a-z]'  # Improper capitals
        ]

        return any(re.search(pattern, text) for pattern in patterns)

    @staticmethod
    def segment_preserve_case(token: str) -> List[str]:
        """Segment word while preserving original case pattern."""
        from wordsegment import segment
        segments = segment(token.lower())

        if len(segments) <= 1:
            return [token]

        # Map original casing to segments
        result = []
        current_pos = 0
        for seg in segments:
            seg_len = len(seg)
            original_case = token[current_pos:current_pos + seg_len]

            if original_case.isupper():
                result.append(seg.upper())
            elif original_case[0].isupper():
                result.append(seg.capitalize())
            else:
                result.append(seg)

            current_pos += seg_len

        return result


# Create a singleton instance for reuse
@lru_cache(maxsize=1)
def get_pipeline():
    """Get or create a singleton instance of the pipeline."""
    return OCRCleanupPipeline()


if __name__ == "__main__":
    pipeline = get_pipeline()

    # Test cases for the enhanced punctuation handling
    test_cases = [
        "TestingThe.Punctuation,AndCasing",
        "Mixed.case.WITH.punctuation.TEST",
        "aotherbeginmateriai(both)pointstohere.substantiatearereality;",
        "This.Is.A.Very.Long.Word.With.Dots",
        "CamelCase(with)NestedPunctuation,andMore",
        "This.is.a.test",
        "Complex(Nested)Punctuation.Here",
        "MixedCASE.with.WEIRD.casing.patterns",
        "This is a test with a verylongwordthatneedstobesplitintomultiplewords and text that is split ac-\nross lines.Aswell as misplacedpunctuation  .",
        "` `` `` -   -  `Mette much about exist- bringpleas-ofWhileitselfroles their who en- the the (for the foro f of `` ` -- ---"
    ]

    for test in test_cases:
        print(f"Input:  {test}")
        print(f"Output: {pipeline.restore_whitespace(test)}\n")