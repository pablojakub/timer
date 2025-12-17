/**
 * AI Motivation Module
 * Handles OpenAI and Azure OpenAI API calls for motivational messages
 * Supports both standard OpenAI and Azure OpenAI with Zscaler compatibility
 */

const OpenAI = require('openai');
const { HttpsProxyAgent } = require('https-proxy-agent');

const API_TIMEOUT = 3000; // 3 seconds
const FALLBACK_QUOTE = "Skupiony głupiec osiągnie więcej niż rozkojarzony mędrzec";

const SYSTEM_PROMPT = `Jesteś mentorem dla programistów seniorów i ekspertem metodologii Deep Work i neuronauki. Twoim celem jest przygotowanie umysłu użytkownika do sesji pracy głębokiem. Generuj jedno, krótkie, zwięzłe zdanie w języku polskim (Maksymalnie 20 słów). Odpowiedź musi odnosić się do konkretnego zadania użytkownika. Styl: stoicki, oparty na faktach, motywujący, ale bez wykrzykników i taniego coachingu. Skup się na jakości, skupieniu, braku błędów i koniecznie korzyściach płynących ze stanu 'flow'.`;

/**
 * Get AI provider settings from localStorage
 */
function getAISettings() {
    return {
        provider: localStorage.getItem('ai_provider') || 'openai', // 'openai' or 'azure'
        openaiApiKey: localStorage.getItem('openai_api_key'),
        azureEndpoint: localStorage.getItem('azure_endpoint'),
        azureApiKey: localStorage.getItem('azure_api_key'),
        azureDeployment: localStorage.getItem('azure_deployment') || 'gpt-4o-mini'
    };
}

/**
 * Check if API key is configured (for either provider)
 */
function hasApiKey() {
    const settings = getAISettings();
    if (settings.provider === 'azure') {
        return settings.azureApiKey && settings.azureApiKey.trim().length > 0 &&
               settings.azureEndpoint && settings.azureEndpoint.trim().length > 0;
    } else {
        return settings.openaiApiKey && settings.openaiApiKey.trim().length > 0;
    }
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
 * Create HTTPS agent with Zscaler certificate trust
 */
function createHttpsAgent() {
    const https = require('https');
    const proxyUrl = getProxyUrl();

    // Configure HTTPS agent to trust Zscaler certificates
    const agentOptions = {
        rejectUnauthorized: false // Trust Zscaler self-signed certificates
    };

    if (proxyUrl) {
        console.log('Using proxy for OpenAI requests:', proxyUrl);
        return new HttpsProxyAgent(proxyUrl, agentOptions);
    } else {
        console.log('Using HTTPS agent with Zscaler certificate trust');
        return new https.Agent(agentOptions);
    }
}

/**
 * Create OpenAI client (standard or Azure) based on settings
 */
function createOpenAIClient() {
    const settings = getAISettings();
    const httpAgent = createHttpsAgent();

    if (settings.provider === 'azure') {
        // Azure OpenAI configuration
        const { AzureOpenAI } = require('openai');

        console.log('Creating Azure OpenAI client:', {
            endpoint: settings.azureEndpoint,
            deployment: settings.azureDeployment
        });

        return new AzureOpenAI({
            endpoint: settings.azureEndpoint,
            apiKey: settings.azureApiKey,
            deployment: settings.azureDeployment,
            apiVersion: '2024-02-15-preview',
            timeout: API_TIMEOUT,
            dangerouslyAllowBrowser: true, // Required for Electron renderer process
            httpAgent: httpAgent
        });
    } else {
        // Standard OpenAI configuration
        console.log('Creating standard OpenAI client');

        return new OpenAI({
            apiKey: settings.openaiApiKey,
            timeout: API_TIMEOUT,
            dangerouslyAllowBrowser: true, // Required for Electron renderer process
            httpAgent: httpAgent
        });
    }
}

/**
 * Get model name for the request (deployment for Azure, model for OpenAI)
 */
function getModelName() {
    const settings = getAISettings();
    if (settings.provider === 'azure') {
        return settings.azureDeployment;
    } else {
        return 'gpt-4o-mini';
    }
}

/**
 * Fetch motivational message from OpenAI or Azure OpenAI API
 */
async function fetchMotivationalMessage(goalText) {
    if (!hasApiKey()) {
        throw new Error('No API key configured');
    }

    const userPrompt = goalText && goalText.trim()
        ? goalText.trim()
        : 'Zmotywuj mnie do sesji Deep Work';

    try {
        const client = createOpenAIClient();
        const modelName = getModelName();

        console.log('Sending request to AI...', { model: modelName });

        const completion = await client.chat.completions.create({
            model: modelName,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 100
        });

        console.log('AI response received:', {
            id: completion.id,
            model: completion.model,
            choices: completion.choices?.length
        });

        const message = completion.choices?.[0]?.message?.content?.trim();

        if (!message) {
            console.error('Empty message from API');
            throw new Error('Empty response from API');
        }

        console.log('Successfully extracted message:', message);
        return message;
    } catch (error) {
        console.error('AI API error:', {
            message: error.message,
            status: error.status
        });

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
