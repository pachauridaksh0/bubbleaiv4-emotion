
export const getUserFriendlyError = (error: Error | any): string => {
  let msg = '';
  if (typeof error === 'string') msg = error.toLowerCase();
  else if (error instanceof Error) msg = error.message.toLowerCase();
  else if (error?.message) msg = error.message.toLowerCase();
  else if (typeof error === 'object') msg = JSON.stringify(error).toLowerCase();

  // OpenRouter Specific Errors
  if (msg.includes('openrouter') || msg.includes('404') || msg.includes('endpoint')) {
      if (msg.includes('image input') || msg.includes('vision') || msg.includes('multimodal')) {
          return "The selected model doesn't support images. Please try using a model like Gemini 2.5 Flash, Gemini 3 Pro, or Claude 3.5 Sonnet.";
      }
      if (msg.includes('404')) {
          return "The selected model is currently unavailable or doesn't exist on OpenRouter. Please try a different model.";
      }
  }

  if (msg.includes('rate limit') || msg.includes('429') || msg.includes('quota')) {
    return "We're sending requests a bit too fast. Please wait a moment and try again.";
  }

  if (msg.includes('schema') || msg.includes('cache')) {
    return "There was a quick hiccup with the database. A page refresh usually fixes this.";
  }
  
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('rpc failed')) {
    return "It seems there's a connection issue. Please check your internet and try again.";
  }
  
  if (msg.includes('api key') || msg.includes('unauthorized') || msg.includes('401')) {
    return "There seems to be an issue with your API key. Please check it in your settings.";
  }

  // If message is still raw JSON or very technical, try to simplify
  if (msg.includes('{') && msg.includes('}')) {
      return "The AI provider returned an unexpected error. Please try a different model.";
  }

  return `Something went wrong: ${error.message || "Unknown error"}`;
};
