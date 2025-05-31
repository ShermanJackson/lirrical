// File: netlify/functions/getLirricalIdeas.js

exports.handler = async function(event, context) {
    // Log when the function is invoked and what it receives
    console.log("--- getLirricalIdeas function invoked! ---");
    console.log("Received event query string parameters:", JSON.stringify(event.queryStringParameters));

    // 1. Get genre and keywords from the query string parameters
    const { genre, keywords } = event.queryStringParameters;

    if (!genre || !keywords) {
        console.error("Missing genre or keywords parameter.");
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Missing genre or keywords parameter." }),
            headers: { "Content-Type": "application/json" },
        };
    }

    // 2. Get API key from environment variables (set this in your Netlify UI)
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error("GEMINI_API_KEY is not set in Netlify environment variables. Make sure it's configured in Netlify site settings for this deployed site.");
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "API key not configured on the server." }),
            headers: { "Content-Type": "application/json" },
        };
    }
    // For debugging, you could log a portion of the key or its presence, but NEVER the full key in production logs.
    // console.log("API Key found (first 5 chars):", apiKey ? apiKey.substring(0, 5) : "Not found");


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

    console.log(`Attempting to call Gemini API at: ${geminiApiUrl.split('key=')[0]}key=API_KEY_REDACTED`); // Log URL without exposing key

    try {
        const geminiResponse = await fetch(geminiApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload)
        });

        console.log("Gemini API response status:", geminiResponse.status);

        if (!geminiResponse.ok) {
            const errorBody = await geminiResponse.text(); // Get error body as text first
            console.error("Gemini API Error Response (status " + geminiResponse.status + "):", errorBody);
            // Try to parse as JSON in case Google sends structured error, otherwise use text
            let detailMessage = errorBody;
            try {
                const parsedError = JSON.parse(errorBody);
                detailMessage = parsedError.error && parsedError.error.message ? parsedError.error.message : errorBody;
            } catch (e) {
                // Parsing failed, use raw errorBody
            }
            return {
                statusCode: geminiResponse.status, // Return actual status from Gemini
                body: JSON.stringify({ error: `Gemini API request failed. Details: ${detailMessage}` }),
                headers: { "Content-Type": "application/json" },
            };
        }

        const result = await geminiResponse.json();
        console.log("Successfully received response from Gemini API.");

        if (result.candidates && result.candidates[0]?.content?.parts?.[0]?.text) {
            const suggestionsJsonString = result.candidates[0].content.parts[0].text;
            console.log("Received suggestions string from Gemini, attempting to parse...");
            try {
                const suggestionsArray = JSON.parse(suggestionsJsonString);
                console.log("Successfully parsed suggestions JSON.");
                return {
                    statusCode: 200,
                    body: JSON.stringify(suggestionsArray), 
                    headers: { 
                        "Content-Type": "application/json",
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
            console.error("Unexpected Gemini API response structure (no valid candidates/parts/text):", JSON.stringify(result, null, 2));
            return {
                statusCode: 500,
                body: JSON.stringify({ error: "AI did not return suggestions in the expected format." }),
                headers: { "Content-Type": "application/json" },
            };
        }

    } catch (error) {
        console.error("General error in Netlify function while calling Gemini API:", error.toString());
        return {
            statusCode: 500,
            body: JSON.stringify({ error: `Server error: ${error.message}` }),
            headers: { "Content-Type": "application/json" },
        };
    }
}; // This should be the very last character in the file.
