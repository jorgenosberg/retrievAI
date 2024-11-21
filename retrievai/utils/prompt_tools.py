from langchain.prompts import PromptTemplate

# Define a simple template for the ChatGPT prompt
prompt_template = """Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer.

<context>
{context}
</context>

Question: {input}:"""

CHAT_PROMPT = PromptTemplate(
    template=prompt_template,
    input_variables=["input", "context"],
)

DOCUMENT_PROMPT = PromptTemplate(
    template="{page_content}\nSource:{file_path}, page {page}",
    input_variables=["page_content", "file_path", "page"]
)
