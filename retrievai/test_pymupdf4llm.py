from pathlib import Path

from retrievai.utils.pymupdf4llm_loaders import PyMuPDF4LLMLoader


def main():

    file_path = Path("/Users/jorgenosberg/development/retrievAI/documents/Murphey, K. M. & Marcus, G. E. (2013)- Epilogue- Ethnography and Design, Ethnography in Design... Ethnography by Design.pdf")

    loader = PyMuPDF4LLMLoader(file_path.as_posix(), page_chunks=True, show_progress=False)

    # md = pymupdf4llm.to_markdown(file_path, page_chunks=True, show_progress=False)

    # for page in md:
    #     print(f"Page {page['metadata']['page']} of {page['metadata']['page_count']}")
    #     print(f"Metadata:\n{page['metadata']}")
    #     print("=" * 80)
    #     print(f"Content:\n{page['text']}")

    for page in loader.lazy_load():

        print(f"Page {page.metadata['page']} of {page.metadata['total_pages']}")
        print(f"Metadata:\n{page.metadata}")
        print("=" * 80)
        print(f"Content:\n{page.page_content}")


if __name__ == "__main__":
    main()