
import { internalSearchEngine } from './webSearchService';

interface ResearchResult {
  answer: string;
  sources: string[];
  verified: boolean;
  depth: 'normal' | 'deep';
}

export class ResearchService {
  
  // Deep research: Uses the InternalSearchEngine to crawl and index real data
  async deepResearch(
    query: string,
    apiKey: string,
    onProgress?: (message: string) => void
  ): Promise<ResearchResult> {
    
    // PHASE 1: Dynamic Query Processing & Crawling
    onProgress?.('Initializing internal search engine...');
    
    // We delegate the "crawl" to our internal engine which uses Gemini Grounding
    const result = await internalSearchEngine.crawl(query, apiKey);
    
    // PHASE 2: Content Extraction & Ranking (Handled by the engine's grounding)
    if (result.sources.length > 0) {
        onProgress?.(`Indexed ${result.sources.length} relevant sources...`);
    } else {
        onProgress?.('No external sources found, relying on internal knowledge base...');
    }

    // PHASE 3: Return raw context
    // We return the grounded content directly. The Autonomous Agent will then use this
    // "raw" context to synthesize the final user-facing answer.
    // This ensures the answer is based on the REAL search data we just fetched.
    
    return {
      answer: result.content,
      sources: result.sources,
      verified: result.sources.length > 0, 
      depth: 'deep'
    };
  }
}

export const researchService = new ResearchService();
