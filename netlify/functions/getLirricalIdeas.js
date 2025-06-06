// File: netlify/functions/getLirricalIdeas.js

// Helper function to add request timeout
const fetchWithTimeout = (url, options, timeoutMs = 9000) => {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
        )
    ]);
};

exports.handler = async function(event, context) {
    // Set function timeout warning
    const timeoutWarning = setTimeout(() => {
        console.log("Function approaching timeout...");
    }, 8000);

    try {
        // 1. Get genre and keywords from the query string parameters
        const { genre, keywords } = event.queryStringParameters;

        if (!genre || !keywords) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Missing genre or keywords parameter." }),
                headers: { "Content-Type": "application/json" },
            };
        }

        // 2. Get API key from environment variables
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            console.error("GEMINI_API_KEY is not set in Netlify environment variables.");
            return {
                statusCode: 500,
                body: JSON.stringify({ error: "API key not configured on the server." }),
                headers: { "Content-Type": "application/json" },
            };
        }

        // 3. OPTIMIZED SHORTER PROMPT - This is the key optimization
        const promptText = `Generate 10 song suggestions for ${genre} music using keywords: "${keywords}".

Return a JSON array of objects with this structure:
{
  "songTitle": "Creative human-sounding title",
  "albumCoverIdeas": {
    "colorPalette": "Color description",
    "typography": "Font style description", 
    "imageryStyle": "Visual concept description",
    "overallMood": "Mood description"
  }
}

Make titles realistic and emotionally resonant. Match album cover ideas to the genre and mood.`;

        let chatHistory = [{ role: "user", parts: [{ text: promptText }] }];
                
        const geminiPayload = {
            contents: chatHistory,
            generationConfig: {
                responseMimeType: "application/json",
                maxOutputTokens: 2000,        // ADDED: Limit response length
                temperature: 0.8,             // ADDED: Slightly more creative
                topP: 0.95,                   // ADDED: Optimize sampling
                candidateCount: 1,            // ADDED: Only generate 1 response
                responseSchema: { 
                    type: "ARRAY",
                    minItems: 1,
                    maxItems: 10,             // REDUCED: From 15 to 10 items
                    items: {
                        type: "OBJECT",
                        properties: {
                            "songTitle": { "type": "STRING" },
                            "albumCoverIdeas": {
                                "type": "OBJECT",
                                "properties": {
                                    "colorPalette": { "type": "STRING" },
                                    "typography": { "type": "STRING" },
                                    "imageryStyle": { "type": "STRING" },
                                    "overallMood": { "type": "STRING" }
                                },
                                required: ["colorPalette", "typography", "imageryStyle", "overallMood"]
                            }
                        },
                        required: ["songTitle", "albumCoverIdeas"]
                    }
                }
            }
        };
        
        const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        // Track processing time
        const startTime = Date.now();
        
        // ADDED: Use fetch with timeout protection
        const geminiResponse = await fetchWithTimeout(geminiApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload)
        }, 9000); // 9 second timeout (1 second buffer)

        const processingTime = Date.now() - startTime;
        clearTimeout(timeoutWarning);
        
        console.log(`Gemini API responded in ${processingTime}ms`);

        if (!geminiResponse.ok) {
            const errorBody = await geminiResponse.text();
            console.error("Gemini API Error Response:", errorBody);
            
            // Handle specific error types
            if (geminiResponse.status === 429) {
                return {
                    statusCode: 429,
                    body: JSON.stringify({ error: "API rate limit reached. Please try again in a moment." }),
                    headers: { "Content-Type": "application/json" },
                };
            }
            
            return {
                statusCode: geminiResponse.status,
                body: JSON.stringify({ 
                    error: `Gemini API request failed with status ${geminiResponse.status}. Please try again.` 
                }),
                headers: { "Content-Type": "application/json" },
            };
        }

        const result = await geminiResponse.json();

        if (result.candidates && result.candidates[0]?.content?.parts?.[0]?.text) {
            const suggestionsJsonString = result.candidates[0].content.parts[0].text;
            try {
                const suggestionsArray = JSON.parse(suggestionsJsonString);
                
                // Validate that we got an array
                if (!Array.isArray(suggestionsArray)) {
                    throw new Error("Response is not an array");
                }
                
                return {
                    statusCode: 200,
                    body: JSON.stringify({
                        suggestions: suggestionsArray,
                        processingTime: processingTime,
                        count: suggestionsArray.length
                    }), 
                    headers: { 
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*", // Adjust for your domain
                    },
                };
            } catch (parseError) {
                console.error("Error parsing suggestions JSON from Gemini API:", parseError, "\nRaw text from Gemini:", suggestionsJsonString);
                return {
                    statusCode: 500,
                    body: JSON.stringify({ error: "Failed to parse suggestions from AI. Please try again." }),
                    headers: { "Content-Type": "application/json" },
                };
            }
        } else {
            console.error("Unexpected Gemini API response structure:", JSON.stringify(result, null, 2));
            return {
                statusCode: 500,
                body: JSON.stringify({ error: "AI did not return suggestions in the expected format." }),
                headers: { "Content-Type": "application/json" },
            };
        }

    } catch (error) {
        clearTimeout(timeoutWarning);
        console.error("Error in Netlify function calling Gemini API:", error);
        
        // Handle specific timeout errors
        if (error.message?.includes('timeout') || error.message?.includes('Request timeout')) {
            return {
                statusCode: 408,
                body: JSON.stringify({ 
                    error: "Request timed out. Please try simpler keywords or try again.",
                    type: "timeout"
                }),
                headers: { "Content-Type": "application/json" },
            };
        }
        
        // Handle network errors
        if (error.message?.includes('fetch')) {
            return {
                statusCode: 503,
                body: JSON.stringify({ 
                    error: "Network error. Please check your connection and try again.",
                    type: "network_error"
                }),
                headers: { "Content-Type": "application/json" },
            };
        }
        
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: "Server error. Please try again.",
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            }),
            headers: { "Content-Type": "application/json" },
        };
    }
};
