export const DEMO_DOCUMENTS = [
  {
    id: '1',
    title: 'What is Machine Learning?',
    content: `Machine Learning is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed.
    ML systems use algorithms to find patterns in data and make predictions or decisions based on those patterns.
    Common applications include recommendation systems, image recognition, and natural language processing.`,
  },
  {
    id: '2',
    title: 'Introduction to Neural Networks',
    content: `Neural networks are computing systems inspired by biological neural networks in animal brains.
    They consist of interconnected nodes (neurons) organized in layers. Each connection has a weight that is adjusted during training.
    Neural networks are particularly effective for tasks like image classification, language translation, and speech recognition.`,
  },
  {
    id: '3',
    title: 'Understanding Deep Learning',
    content: `Deep Learning is a subset of machine learning that uses neural networks with multiple layers (deep neural networks).
    These deep architectures can automatically learn feature representations needed for detection or classification.
    Famous architectures include CNNs for computer vision and RNNs for sequential data processing.`,
  },
  {
    id: '4',
    title: 'Natural Language Processing Basics',
    content: `Natural Language Processing (NLP) is a field of AI that focuses on the interaction between computers and human language.
    NLP techniques enable machines to understand, interpret, and generate human language in a meaningful way.
    Key tasks include sentiment analysis, named entity recognition, machine translation, and question answering.`,
  },
  {
    id: '5',
    title: 'Introduction to Transformers',
    content: `Transformers are a type of neural network architecture introduced in the paper "Attention is All You Need".
    They use self-attention mechanisms to process sequential data in parallel, making them more efficient than RNNs.
    Transformers form the basis of modern language models like BERT, GPT, and T5.`,
  },
];

export interface Document {
  id: string;
  title: string;
  content: string;
}
