/**
 * AI Motivation Module
 * Handles OpenAI API calls for motivational messages
 */

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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.7,
                max_tokens: 100
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        const message = data.choices?.[0]?.message?.content?.trim();

        if (!message) {
            throw new Error('Empty response from API');
        }

        return message;
    } catch (error) {
        clearTimeout(timeoutId);

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
