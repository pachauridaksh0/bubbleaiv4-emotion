
// services/externalSearchService.ts

export type WebSearchResult = {
    title: string;
    url: string;
    snippet?: string;
    content?: string;
};

/**
 * Determines if we should trigger the external search pipeline.
 */
export function shouldUseExternalSearch(userMessage: string, modelSupportsSearch: boolean, hasSearchTag: boolean): boolean {
    // If the model has built-in search (e.g. Perplexity), prioritize that unless a tag forces our hand.
    if (modelSupportsSearch && !hasSearchTag) return false; 

    const lower = userMessage.toLowerCase();
    const keywords = [
        "search online",
        "search the web",
        "look this up",
        "browse",
        "check internet",
        "latest",
        "today",
        "news",
        "price",
        "who is",
        "what is",
        "when did"
    ];

    const keywordHit = keywords.some(kw => lower.includes(kw));
    return keywordHit || hasSearchTag;
}

/**
 * Executes a search via the custom Bubble Search API.
 */
async function runBubbleSearch(query: string, limit: number = 15): Promise<WebSearchResult[]> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

        // Updated endpoint to the new deployment
        const resp = await fetch("https://bubble-search-api-ndni.vercel.app/api/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query, limit }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!resp.ok) {
            console.warn(`Bubble Search API returned status ${resp.status} ${resp.statusText}`);
            throw new Error(`Bubble Search API Error: ${resp.status}`);
        }
        
        const data = await resp.json();
        
        if (data.success && Array.isArray(data.results)) {
            return data.results.map((r: any) => ({
                title: r.title || "Untitled Page",
                url: r.url,
                snippet: r.snippet || "No description available.",
                content: r.snippet 
            }));
        }
        return [];
    } catch (error) {
        console.warn("Primary search provider failed:", error);
        throw error; // Propagate to trigger fallback
    }
}

/**
 * Fallback search using DuckDuckGo Instant Answer API.
 * Does not require an API key and usually supports CORS for GET requests.
 */
async function runDuckDuckGoFallback(query: string): Promise<WebSearchResult[]> {
    try {
        const resp = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&skip_disambig=1`);
        if (!resp.ok) return [];
        const data = await resp.json();
        const results: WebSearchResult[] = [];

        // 1. Abstract (Main Result)
        if (data.AbstractURL && data.Heading) {
            results.push({
                title: data.Heading,
                url: data.AbstractURL,
                snippet: data.Abstract || "Result from DuckDuckGo",
                content: data.Abstract
            });
        }

        // 2. Related Topics
        if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
            data.RelatedTopics.slice(0, 5).forEach((t: any) => {
                if (t.FirstURL && t.Text) {
                    results.push({
                        title: t.Text.split(' - ')[0] || "Related Result",
                        url: t.FirstURL,
                        snippet: t.Text,
                        content: t.Text
                    });
                }
            });
        }
        return results;
    } catch (e) {
        console.error("Fallback search failed:", e);
        return [];
    }
}

/**
 * Main Unified Search Function with Fallback Strategy.
 */
export async function runWebSearch(query: string, limit: number = 15): Promise<WebSearchResult[]> {
    try {
        return await runBubbleSearch(query, limit);
    } catch (e) {
        console.log("Switching to DuckDuckGo fallback...");
        return await runDuckDuckGoFallback(query);
    }
}

export const runMcpWebSearch = runWebSearch;

export async function fetchContentsForResults(results: WebSearchResult[], limit: number = 15): Promise<WebSearchResult[]> {
    return results.slice(0, limit);
}

export async function fetchPageContentWithJina(url: string): Promise<string> {
    return "";
}
