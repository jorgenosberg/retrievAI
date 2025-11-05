"""PDF parsing utilities using PyMuPDF4LLM.

This module contains custom PDF parsers with OCR fallback capabilities.
Updated for async file I/O compatibility.
"""

import io
import logging
from pathlib import Path
from typing import Optional, Mapping, Any, Iterator

import ocrmypdf
import pymupdf
import pymupdf4llm
from langchain_core.document_loaders import BaseBlobParser
from langchain_core.documents import Document
from langchain_core.documents.base import Blob

from app.core.markdown import normalize_markdown
from app.core.ocr import get_pipeline

logger = logging.getLogger(__name__)


def ocr_fallback(file_path: str, page_number: int) -> str:
    """Perform OCR on a specific page of the PDF."""
    file_path = Path(file_path)
    try:
        # Open the original PDF
        doc = pymupdf.open(file_path)

        # Create a new document containing only the specific page
        new_doc = pymupdf.Document()
        new_doc.insert_pdf(doc, from_page=page_number, to_page=page_number)

        # Convert the single-page document to a BytesIO object
        inbytes = io.BytesIO(new_doc.tobytes())
        outbytes = io.BytesIO()

        # Perform OCR on the single-page PDF
        ocrmypdf.ocr(
            input_file=inbytes,
            output_file=outbytes,
            language="eng",
            output_type="pdf"
        )

        # Open the OCR output as a PyMuPDF document
        outbytes.seek(0)  # Reset the BytesIO stream position
        result_doc = pymupdf.open("pdf", outbytes.getvalue())  # Specify type explicitly

        # Extract text from the OCR-ed PDF
        text = pymupdf4llm.to_markdown(result_doc, page_chunks=False)

        # Restore whitespace etc.
        ocr_cleanup_pipeline = get_pipeline()
        text = ocr_cleanup_pipeline.restore_whitespace(text)

        if not text:
            logger.warning(f"OCR could not retrieve text for page {page_number}.")
        return text
    except Exception as e:
        logger.error(f"Failed to perform OCR on page {page_number} for {file_path}: {e}")
        return ""


class PyMuPDF4LLMParser(BaseBlobParser):
    """Parse `PDF` using `pymupdf4llm`."""

    def __init__(
            self,
            page_chunks: bool = True,
            **kwargs: Optional[Mapping[str, Any]],
    ) -> None:
        """Initialize the parser.

        Args:
            page_chunks: Whether to split PDF into page chunks during markdown conversion.
        """
        self.page_chunks = page_chunks
        self.kwargs = kwargs or {}

    def lazy_parse(self, blob: Blob) -> Iterator[Document]:
        """Lazily parse the blob."""
        with blob.as_bytes_io() as file_path:  # type: ignore[attr-defined]
            try:
                # Convert PDF to Markdown with pymupdf4llm
                markdown_pages = pymupdf4llm.to_markdown(file_path, page_chunks=self.page_chunks, **self.kwargs)

                for idx, page in enumerate(markdown_pages):
                    # Metadata for each page
                    text = page["text"]  # type: ignore[attr-defined]
                    metadata = page["metadata"]  # type: ignore[attr-defined]

                    is_ocr = False

                    if not text.strip() or not text.strip().strip("-"):
                        logger.info(f"Empty text content for page {idx} in {blob.source}. Performing OCR.")
                        text = ocr_fallback(blob.source, idx)
                        is_ocr = True

                    text = normalize_markdown(text)

                    metadata = {
                        "source": metadata["file_path"],  # type: ignore[attr-defined]
                        "file_path": metadata["file_path"],  # type: ignore[attr-defined]
                        "page": metadata["page"],  # type: ignore[attr-defined]
                        "total_pages": metadata["page_count"],  # type: ignore[attr-defined]
                        "format": metadata["format"],  # type: ignore[attr-defined]
                        "title": metadata["title"],  # type: ignore[attr-defined]
                        "author": metadata["author"],  # type: ignore[attr-defined]
                        "subject": metadata["subject"],  # type: ignore[attr-defined]
                        "keywords": metadata["keywords"],  # type: ignore[attr-defined]
                        "creator": metadata["creator"],  # type: ignore[attr-defined]
                        "producer": metadata["producer"],  # type: ignore[attr-defined]
                        "creationDate": metadata["creationDate"],  # type: ignore[attr-defined]
                        "modDate": metadata["modDate"],  # type: ignore[attr-defined]
                        "trapped": metadata["trapped"],  # type: ignore[attr-defined]
                        "is_ocr": is_ocr,
                    }

                    yield Document(page_content=text, metadata=metadata)

            except Exception as e:
                logger.error(f"Failed to parse {blob.source}: {e}")
                raise
