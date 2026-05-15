# RAG Pipeline Testing Guide

## Setup

1. **Set your Anthropic API Key** in `.env`:
   ```bash
   ANTHROPIC_API_KEY=sk-ant-... # Your actual API key
   ```

2. **Start the API**:
   ```bash
   cd apps/api
   npm run dev
   ```
   The API will run on `http://localhost:3001`

## Endpoints

### 1. Initialize Demo Data
```bash
curl -X POST http://localhost:3001/rag/init
```

Response:
```json
{
  "message": "Demo data initialized",
  "documents": [
    {
      "id": "1",
      "title": "What is Machine Learning?",
      "content": "..."
    },
    ...
  ]
}
```

### 2. Query the RAG Pipeline
```bash
curl -X POST http://localhost:3001/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What is a neural network?"}'
```

Response:
```json
{
  "query": "What is a neural network?",
  "answer": "Based on the provided documents...",
  "retrievedDocs": [
    {
      "id": "2",
      "title": "Introduction to Neural Networks",
      "content": "..."
    },
    ...
  ]
}
```

### 3. Get All Documents
```bash
curl http://localhost:3001/rag/documents
```

### 4. Health Check
```bash
curl http://localhost:3001/rag/health
```

## Test Queries

Try these queries to test the RAG pipeline:

1. **"What is machine learning?"**
   - Should retrieve docs about ML and return relevant explanation

2. **"Explain neural networks"**
   - Should retrieve docs about neural networks and transformers

3. **"What are transformers used for?"**
   - Should retrieve transformer documentation

4. **"Tell me about natural language processing"**
   - Should retrieve NLP documents

5. **"What is deep learning?"**
   - Should retrieve deep learning documentation

## Architecture Overview

```
User Query
    ↓
[Embeddings Service] - Converts text to embeddings
    ↓
[Vector Store] - Searches similar documents (cosine similarity)
    ↓
[Retrieved Documents] - Top 3 most similar documents
    ↓
[Prompt Building] - Creates context with retrieved docs
    ↓
[Claude API] - Generates answer using context
    ↓
Response with Answer + Retrieved Docs
```

## How It Works

1. **Embedding Generation**: Text is converted to embeddings based on keyword frequency
2. **Vector Search**: User query is embedded and compared against document embeddings using cosine similarity
3. **Context Building**: Top K matching documents are selected as context
4. **LLM Generation**: Claude receives the query + context and generates a response
5. **Response**: Returns the answer along with which documents were used

## Next Steps

- [ ] Test basic queries
- [ ] Verify retrieved documents are relevant
- [ ] Check API responses
- [ ] Replace demo embeddings with real embedding models
- [ ] Add database persistence
- [ ] Add document upload/ingestion endpoints
- [ ] Add authentication
