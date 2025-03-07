from typing import Iterator, List, Any

from langchain_community.document_loaders.pdf import BasePDFLoader
from langchain_core.documents import Document
from langchain_core.documents.base import Blob

from retrievai.utils.pymupdf4llm_parsers import PyMuPDF4LLMParser


class PyMuPDF4LLMLoader(BasePDFLoader):
    """Load `PDF` files using `pymupdf4llm`."""

    def __init__(self, file_path: str, *, page_chunks: bool = True, **kwargs: Any) -> None:
        """Initialize with a file path."""
        super().__init__(file_path)
        try:
            import pymupdf4llm  # noqa:F401
        except ImportError:
            raise ImportError(
                "`pymupdf4llm` package not found, please install it with "
                "`pip install pymupdf4llm`"
            )
        self.file_path = file_path
        self.page_chunks = page_chunks
        self.kwargs = kwargs or {}

    def lazy_load(self) -> Iterator[Document]:
        blob = Blob.from_path(self.file_path)  # type: ignore[attr-defined]
        parser = PyMuPDF4LLMParser(page_chunks=self.page_chunks, **self.kwargs)
        yield from parser.lazy_parse(blob)

    def load(self) -> List[Document]:
        return list(self.lazy_load())
