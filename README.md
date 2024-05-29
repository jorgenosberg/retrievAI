# RetrievAI

RetrievAI is a simple Streamlit application designed to facilitate Retrieval-Augmented-Generation (RAG) for literature search and review purposes. The app leverages ChromaDB and the OpenAI API to provide an efficient and effective way to search and review literature documents.

## Screenshots

![Home Page](assets/screenshot_home.png)

## Packages Used

- **Streamlit**: A web application framework that allows the creation of interactive and beautiful web apps quickly.
- **LangChain**: A framework for developing applications powered by language models.
- **ChromaDB**: A database designed to handle embedding-based retrieval tasks efficiently.
- **OpenAI API**: Provides access to OpenAI's language models for natural language understanding and generation.

## How to Run the App

Follow these steps to set up and run the RetrievAI application on your local machine:

### 1. Clone or Fork the Repo

First, you need to clone or fork the repository to your local machine. (Or you can download the code as a ZIP file and extract it.)

```bash
git clone https://github.com/yourusername/RetrievAI.git
cd RetrievAI
```

### 2. Install the Required Packages

Install the required packages from `requirements.txt`.

```bash
pip install -r requirements.txt
```

### 3. Modify Settings in .streamlit/secrets.toml

Update the `.streamlit/secrets.toml` file with the necessary settings, including your OpenAI API key. The file should look something like this:

```toml
[api_keys]
openai_api_key = "your_openai_api_key_here"
```

### 4. Add Source Documents

Add your source documents to the `source_documents` folder. These documents will be used for the literature search and review.

### 5. Run Ingestion Script

Run the ingestion script to process and store the source documents in ChromaDB.

```bash
python ingest.py
```

### 6. Run the Streamlit App

Finally, run the Streamlit app.

```bash
streamlit run Home.py
```

Your app should now be running on `http://localhost:8501`, and you can interact with it through your web browser.

## Folder Structure

- `source_documents/`: Folder where you should place your source documents.
- `.streamlit/secrets.toml`: File to store sensitive information like API keys.
- `ingest.py`: Script to ingest and process source documents into ChromaDB.
- `Home.py`: Main script to run the Streamlit app.

## Additional Information

For more information on each package and how they are used within the app, refer to the following documentation:

- [Streamlit Documentation](https://docs.streamlit.io/)
- [LangChain Documentation](https://docs.langchain.com/)
- [ChromaDB Documentation](https://chromadb.com/docs)
- [OpenAI API Documentation](https://beta.openai.com/docs/)

By following these steps, you should be able to set up and run the RetrievAI app, making literature search and review more efficient and effective. Enjoy using RetrievAI!
