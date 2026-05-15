#!/bin/bash

API_URL="http://localhost:3001"
RAG_ENDPOINT="$API_URL/rag"

echo "🚀 RAG Pipeline Test Suite"
echo "================================"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if API is running
echo -e "${BLUE}1. Checking API health...${NC}"
if ! curl -s "$RAG_ENDPOINT/health" > /dev/null; then
  echo -e "${YELLOW}⚠️  API is not running. Start it with: npm run dev${NC}"
  exit 1
fi
echo -e "${GREEN}✓ API is running${NC}\n"

# Initialize demo data
echo -e "${BLUE}2. Initializing demo data...${NC}"
curl -s -X POST "$RAG_ENDPOINT/init" | jq .
echo -e "\n${GREEN}✓ Demo data initialized${NC}\n"

# Get documents
echo -e "${BLUE}3. Fetching loaded documents...${NC}"
curl -s "$RAG_ENDPOINT/documents" | jq '.documents | length' | sed 's/^/   Found /' | sed 's/$/ documents/'
echo -e "\n"

# Test queries
echo -e "${BLUE}4. Running test queries...${NC}"
echo "================================\n"

test_queries=(
  "What is machine learning?"
  "Explain neural networks"
  "What are transformers used for?"
  "Tell me about natural language processing"
  "What is deep learning?"
)

for i in "${!test_queries[@]}"; do
  query="${test_queries[$i]}"
  echo -e "${YELLOW}Query $((i+1)): $query${NC}"
  echo "---"

  response=$(curl -s -X POST "$RAG_ENDPOINT/query" \
    -H "Content-Type: application/json" \
    -d "{\"query\": \"$query\"}")

  echo "Answer:"
  echo "$response" | jq -r '.answer'
  echo ""

  echo "Retrieved Documents:"
  echo "$response" | jq -r '.retrievedDocs[] | "  - \(.title)"'
  echo ""
  echo "================================\n"
done

echo -e "${GREEN}✓ All tests completed!${NC}"
