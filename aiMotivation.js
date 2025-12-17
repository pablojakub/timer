/**
 * AI Motivation Module
 * Handles OpenAI API calls for motivational messages
 * Uses official OpenAI client with proxy support (for Zscaler compatibility)
 */

const OpenAI = require('openai');
const { HttpsProxyAgent } = require('https-proxy-agent');

const API_TIMEOUT = 3000; // 3 seconds
const FALLBACK_QUOTE = "Skupiony głupiec osiągnie więcej niż rozkojarzony mędrzec";

const SYSTEM_PROMPT = `Jesteś mentorem dla programistów seniorów i ekspertem metodologii Deep Work i neuronauki. Twoim celem jest przygotowanie umysłu użytkownika do sesji pracy głębokiem. Generuj jedno, krótkie, zwięzłe zdanie w języku polskim (Maksymalnie 20 słów). Odpowiedź musi odnosić się do konkretnego zadania użytkownika. Styl: stoicki, oparty na faktach, motywujący, ale bez wykrzykników i taniego coachingu. Skup się na jakości, skupieniu, braku błędów i koniecznie korzyściach płynących ze stanu 'flow'.`;

/**
 * Get OpenAI API key from localStorage
 */
function getApiKey() {
    return localStorage.getItem('openai_api_key');
}

/**
 * Check if API key is configured
 */
function hasApiKey() {
    const apiKey = getApiKey();
    return apiKey && apiKey.trim().length > 0;
}

/**
 * Detect proxy from environment variables (like GitHub Copilot does)
 */
function getProxyUrl() {
    return process.env.HTTPS_PROXY ||
           process.env.HTTP_PROXY ||
           process.env.https_proxy ||
           process.env.http_proxy;
}

/**
 * Create OpenAI client with proxy support
 */
function createOpenAIClient(apiKey) {
    const proxyUrl = getProxyUrl();

    const config = {
        apiKey: apiKey,
        timeout: API_TIMEOUT,
    };

    // If proxy is detected, use HttpsProxyAgent (like Copilot does)
    if (proxyUrl) {
        config.httpAgent = new HttpsProxyAgent(proxyUrl);
        console.log('Using proxy for OpenAI requests:', proxyUrl);
    }

    return new OpenAI(config);
}

/**
 * Fetch motivational message from OpenAI API with timeout
 */
async function fetchMotivationalMessage(goalText) {
    const apiKey = getApiKey();

    if (!apiKey) {
        throw new Error('No API key configured');
    }

    const userPrompt = goalText && goalText.trim()
        ? goalText.trim()
        : 'Zmotywuj mnie do sesji Deep Work';

    try {
        const openai = createOpenAIClient(apiKey);

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 100
        });

        const message = completion.choices?.[0]?.message?.content?.trim();

        if (!message) {
            throw new Error('Empty response from API');
        }

        return message;
    } catch (error) {
        console.error('OpenAI API error:', error.message);

        // Return fallback quote on any error
        return FALLBACK_QUOTE;
    }
}

/**
 * Get motivational message (or null if API key not configured)
 */
async function getMotivationalMessage(goalText) {
    if (!hasApiKey()) {
        return null; // Skip motivation if no API key
    }

    try {
        const message = await fetchMotivationalMessage(goalText);
        return message;
    } catch (error) {
        console.error('Failed to get motivational message:', error);
        return FALLBACK_QUOTE;
    }
}

// Export functions for use in renderer
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        hasApiKey,
        getMotivationalMessage,
        FALLBACK_QUOTE
    };
}
