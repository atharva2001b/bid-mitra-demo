/**
 * LLM Configuration Utility
 * 
 * Provides access to LLM provider settings stored in localStorage
 * and window object for runtime access throughout the app.
 */

export type LLMProvider = "cdac" | "gemini";

export interface LLMConfig {
  provider: LLMProvider;
  cdacApiKey: string;
  geminiApiKey: string;
}

/**
 * Get the current LLM configuration
 */
export function getLLMConfig(): LLMConfig {
  if (typeof window === "undefined") {
    // Server-side: return defaults
    return {
      provider: "cdac",
      cdacApiKey: "",
      geminiApiKey: "",
    };
  }

  // Try to get from window object first (runtime)
  const windowProvider = (window as any).__LLM_PROVIDER__;
  const windowCdacKey = (window as any).__CDAC_API_KEY__;
  const windowGeminiKey = (window as any).__GEMINI_API_KEY__;

  if (windowProvider) {
    return {
      provider: windowProvider as LLMProvider,
      cdacApiKey: windowCdacKey || "",
      geminiApiKey: windowGeminiKey || "",
    };
  }

  // Fallback to localStorage
  const provider = (localStorage.getItem("llm_provider") || "cdac") as LLMProvider;
  const cdacApiKey = localStorage.getItem("cdac_api_key") || "";
  const geminiApiKey = localStorage.getItem("gemini_api_key") || "";

  return {
    provider,
    cdacApiKey,
    geminiApiKey,
  };
}

/**
 * Get the API key for the current provider
 */
export function getCurrentAPIKey(): string {
  const config = getLLMConfig();
  return config.provider === "cdac" ? config.cdacApiKey : config.geminiApiKey;
}

/**
 * Get the current LLM provider
 */
export function getCurrentProvider(): LLMProvider {
  const config = getLLMConfig();
  return config.provider;
}

/**
 * Check if LLM is configured
 */
export function isLLMConfigured(): boolean {
  const config = getLLMConfig();
  if (config.provider === "cdac") {
    return config.cdacApiKey.trim().length > 0;
  } else {
    return config.geminiApiKey.trim().length > 0;
  }
}

/**
 * Get CDAC API endpoint URL
 */
export function getCDACEndpoint(): string {
  return "https://apis.airawat.cdac.in/wrp/gpt20b/v1/chat/completions";
}

/**
 * Get Gemini API endpoint URL
 */
export function getGeminiEndpoint(): string {
  // Using gemini-1.5-flash (free tier, faster) - can be changed to gemini-1.5-pro for more capability
  return "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
}

