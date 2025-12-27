

export const validateOpenRouterKey = async (apiKey: string): Promise<{ success: boolean, message?: string }> => {
    if (!apiKey) {
        return { success: false, message: "API key cannot be empty." };
    }

    try {
        // We verify the key by attempting to list models. This is a lightweight read operation.
        const response = await fetch("https://openrouter.ai/api/v1/models", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            }
        });

        if (response.ok) {
            return { success: true };
        } else {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error?.message || `API returned status ${response.status}`;
            
            if (response.status === 401) {
                return { success: false, message: "Invalid OpenRouter API key." };
            }
            
            return { success: false, message: `Validation failed: ${errorMessage}` };
        }
    } catch (error: any) {
        console.error("OpenRouter Key validation failed:", error);
        return { success: false, message: "Could not connect to OpenRouter. Please check your connection." };
    }
};