import json

import openai
from langchain_core.documents import Document


def prepare_batch_jsonl(chunks, file_path):
    with open(file_path, 'w') as f:
        for chunk in chunks:
            data = {
                "input": chunk.page_content,
                "metadata": chunk.metadata,
            }
            f.write(json.dumps(data) + '\n')

response = openai.File.create(
    file=open("path_to_jsonl_file.jsonl"),
    purpose="batch"
)
input_file_id = response["id"]

batch_response = openai.Batch.create(
    input_file_id=input_file_id,
    endpoint="/v1/embeddings",
    completion_window="24h"
)

def check_batch_status(batch_id):
    response = openai.Batch.retrieve(batch_id)
    return response["status"], response

if batch_status == "completed":
    results_file = openai.File.retrieve(batch_response["result_file"])
    with open("results.jsonl", "w") as f:
        f.write(results_file["data"])

def add_batch_results_to_vectorstore(results_file, vectorstore):
    with open(results_file, 'r') as f:
        for line in f:
            result = json.loads(line)
            chunk_metadata = result["metadata"]
            embedding = result["embedding"]
            vectorstore.add_document(Document(
                page_content=chunk_metadata["input"],
                metadata=chunk_metadata,
                embedding=embedding
            ))

if batch_mode:
    jsonl_file_path = "path_to_save_jsonl_file.jsonl"
    prepare_batch_jsonl(chunks, jsonl_file_path)
    input_file_id = upload_file_to_openai(jsonl_file_path)
    batch_response = submit_batch_request(input_file_id)
    batch_status, batch_result = check_batch_status(batch_response["id"])
    if batch_status == "completed":
        add_batch_results_to_vectorstore("results.jsonl", vectorstore)
else:
    # Normal ingestion process
    vectorstore.add_documents(chunks)
