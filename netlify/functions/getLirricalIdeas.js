// File: netlify/functions/getLirricalIdeas.js

// We might need 'node-fetch' if running in an older Node.js environment on Netlify,
// but modern Netlify functions often have global fetch.
// For robustness, it's good practice to include it.
// You'd need to add "node-fetch" to your package.json if you had one,
// or Netlify might bundle it if you `require` it.
// For this example, I'll assume global fetch is available or polyfilled by Netlify.
// If not, you'd do: const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    // 1. Get genre and keywords from the query string parameters
    // (e.g., /.netlify/functions/getLirricalIdeas?genre=Pop&keywords=summer%20nights)
    const { genre, keywords } = event.queryStringParameters;

    if (!genre || !keywords) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Missing genre or keywords parameter." }),
            headers: { "Content-Type": "application/json" },
        };
    }

    // 2. Get API key from environment variables (set this in your Netlify UI)
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error("GEMINI_API_KEY is not set in Netlify environment variables.");
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "API key not configured on the server." }),
            headers: { "Content-Type": "application/json" },
        };
    }

    // 3. Construct the prompt (same as your client-side version)
    const promptText = `You are an expert creative consultant for musicians named LIRIC.
Based on the following genre and keyword/lyric, generate an array of 12 distinct song suggestions. 
Each suggestion object in the array must include:
1.  "songTitle": A unique and creative song title.
2.  "albumCoverIdeas": An object with:
    a.  "colorPalette": A descriptive color palette.
    b.  "typography": Suggested typography style.
    c.  "imageryStyle": Ideas for imagery or visual elements.
    d.  "overallMood": The overall mood or vibe the cover should convey.

Genre: ${genre}
Keyword/Lyric: "${keywords}"

Respond ONLY with the JSON array, adhering strictly to the specified structure. Do not include any introductory text, explanations, or markdown formatting outside the JSON.`;

    let chatHistory = [{ role: "user", parts: [{ text: promptText }] }];
            
    const geminiPayload = {
        contents: chatHistory,
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: { 
                type: "ARRAY",
                minItems: 1, 
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

    try {
        const geminiResponse = await fetch(geminiApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload)
        });

        if (!geminiResponse.ok) {
            const errorBody = await geminiResponse.text();
            console.error("Gemini API Error Response:", errorBody);
            return {
                statusCode: geminiResponse.status,
                body: JSON.stringify({ error: `Gemini API request failed with status ${geminiResponse.status}. Details: ${errorBody}` }),
                headers: { "Content-Type": "application/json" },
            };
        }

        const result = await geminiResponse.json();

        if (result.candidates && result.candidates[0]?.content?.parts?.[0]?.text) {
            const suggestionsJsonString = result.candidates[0].content.parts[0].text;
            // The 'text' part itself is a JSON string representing the array of suggestions.
            // We need to parse this string to get the actual array.
            try {
                const suggestionsArray = JSON.parse(suggestionsJsonString);
                return {
                    statusCode: 200,
                    body: JSON.stringify(suggestionsArray), // Return the parsed array, stringified for HTTP response
                    headers: { 
                        "Content-Type": "application/json",
                        // Optional: Add CORS headers if your client and function are on different subdomains
                        // or if you plan to call this from elsewhere.
                        // "Access-Control-Allow-Origin": "*", // Or your specific domain
                        // "Access-Control-Allow-Headers": "Content-Type",
                        // "Access-Control-Allow-Methods": "GET, POST, OPTIONS" 
                    },
                };
            } catch (parseError) {
                console.error("Error parsing suggestions JSON from Gemini API:", parseError, "\nRaw text from Gemini:", suggestionsJsonString);
                return {
                    statusCode: 500,
                    body: JSON.stringify({ error: "Failed to parse suggestions from AI." }),
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
        console.error("Error in Netlify function calling Gemini API:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: `Server error: ${error.message}` }),
            headers: { "Content-Type": "application/json" },
        };
    }
};