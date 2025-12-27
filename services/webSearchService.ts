
import { GoogleGenAI } from "@google/genai";
import { supabase } from "../supabaseClient";

/**
 * Retrieval Chain Service (Hybrid Implementation)
 */

interface SearchDocument {
    pageContent: string;
    metadata: Record<string, any>;
}

// --- Direct API Clients ---

class TavilySearchClient {
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    async search(query: string): Promise<SearchDocument[]> {
        try {
            const response = await fetch("https://api.tavily.com/search", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    api_key: this.apiKey,
                    query: query,
                    search_depth: "basic",
                    include_raw_content: true,
                    max_results: 10,
                    include_images: false
                })
            });

            if (!response.ok) {
                throw new Error(`Tavily API error: ${response.statusText}`);
            }

            const data = await response.json();
            const results = data.results || [];

            return results.map((result: any) => ({
                pageContent: result.raw_content || result.content,
                metadata: {
                    source: result.url,
                    title: result.title,
                    score: result.score,
                    type: 'search'
                }
            }));

        } catch (error) {
            console.warn("Tavily search failed:", error);
            return [];
        }
    }
}

class DuckDuckGoClient {
    async search(query: string): Promise<SearchDocument[]> {
        try {
            const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`);
            if (!response.ok) {
                throw new Error(`DuckDuckGo API status ${response.status}`);
            }
            const data = await response.json();
            const results: SearchDocument[] = [];

            if (data.Abstract) {
                results.push({
                    pageContent: data.Abstract,
                    metadata: { source: data.AbstractURL, title: data.Heading, type: 'ddg-abstract' }
                });
            }

            if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
                data.RelatedTopics.slice(0, 5).forEach((topic: any) => {
                    if (topic.Text && topic.FirstURL) {
                        results.push({
                            pageContent: topic.Text,
                            metadata: { source: topic.FirstURL, title: 'Related Topic', type: 'ddg-related' }
                        });
                    }
                });
            }
            return results;
        } catch (error) {
            console.warn("DuckDuckGo search failed:", error);
            return [];
        }
    }
}

class GoogleGroundingRetriever {
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    async invoke(query: string): Promise<SearchDocument[]> {
        const ai = new GoogleGenAI({ apiKey: this.apiKey });
        try {
            let effectiveQuery = query;
            if (query.includes('youtube.com') || query.includes('youtu.be')) {
                if (!query.includes(' ')) { 
                    effectiveQuery = `site:youtube.com "${query}" video title and description`;
                }
            }

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Search the web for: "${effectiveQuery}". Provide a detailed, factual summary.`,
                config: {
                    tools: [{ googleSearch: {} }],
                    temperature: 0.1,
                },
            });

            const text = response.text || "No results found.";
            const metadata: any = { source: 'Google Grounding', type: 'search' };

            if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
                const links = response.candidates[0].groundingMetadata.groundingChunks
                    .map((chunk: any) => chunk.web?.uri)
                    .filter(Boolean);
                metadata.related_links = links;
            }

            return [{
                pageContent: text,
                metadata: metadata
            }];
        } catch (error: any) {
            console.error("Google Grounding failed:", error);
            return [{ pageContent: `Search failed: ${error.message}`, metadata: { error: true } }];
        }
    }
}

export class RetrievalService {
    
    /**
     * Main entry point: Crawl/Search the web.
     */
    async crawl(query: string, geminiApiKey: string): Promise<{ content: string; sources: string[] }> {
        const { data: { session } } = await supabase.auth.getSession();
        
        let tavilyKey: string | null = null;

        if (session?.user) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('tavily_api_key')
                .eq('id', session.user.id)
                .single();
            tavilyKey = profile?.tavily_api_key;
        }
        
        // === PRIORITY 1: TAVILY (Premium High Quality) ===
        if (tavilyKey) {
            const client = new TavilySearchClient(tavilyKey);
            try {
                const docs = await client.search(query);
                if (docs && docs.length > 0) {
                    return this.formatDocuments(docs);
                }
            } catch (error) {
                console.error("Tavily search failed, trying next method.", error);
            }
        }

        // === PRIORITY 2: DUCKDUCKGO (Client Side) ===
        const ddgClient = new DuckDuckGoClient();
        try {
            const docs = await ddgClient.search(query);
            if (docs && docs.length > 0) {
                return this.formatDocuments(docs);
            }
        } catch (error) {
             console.warn("DuckDuckGo failed, falling back to Google Grounding.");
        }

        // === PRIORITY 3: GOOGLE GROUNDING (Final Fallback) ===
        const retriever = new GoogleGroundingRetriever(geminiApiKey);
        const docs = await retriever.invoke(query);
        return this.formatDocuments(docs);
    }

    // Helper to format Documents into a context string and source list
    private formatDocuments(docs: SearchDocument[]): { content: string; sources: string[] } {
        const sources: string[] = [];
        const contentParts: string[] = [];

        docs.forEach((doc, index) => {
            const sourceUrl = doc.metadata?.source || doc.metadata?.url || '';
            if (sourceUrl && !sourceUrl.includes('Abstract')) sources.push(sourceUrl);
            
            // Also check for Google Grounding related links
            if (doc.metadata?.related_links && Array.isArray(doc.metadata.related_links)) {
                sources.push(...doc.metadata.related_links);
            }

            contentParts.push(`Source [${index + 1}] ${sourceUrl ? `(${sourceUrl})` : ''}:\n${doc.pageContent}`);
        });

        return {
            content: contentParts.join('\n\n'),
            sources: [...new Set(sources)] // Dedup URLs
        };
    }
}

export const internalSearchEngine = new RetrievalService();
