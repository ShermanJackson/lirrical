// File: netlify/functions/getLirricalIdeas.js

exports.handler = async function(event, context) {
    // 1. Get genre and keywords from the query string parameters
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
    const promptText = `You are an expert creative consultant and songwriting partner for musicians, named LIRIC.
Your goal is to provide song suggestions that are not only creative but also deeply human-sounding, realistic, and relatable.

Based on the provided genre and keyword/lyric, generate an array of 15 distinct song suggestion objects.
Each suggestion object in the array must include:
1.  "songTitle": A unique song title. This title should sound natural, as if written by a human songwriter. It should be realistic and avoid overly abstract, robotic, or nonsensical phrasing. Aim for titles that are emotionally resonant, intriguing, or capture a clear image or feeling in a down-to-earth way.
2.  "albumCoverIdeas": An object with four keys: "colorPalette", "typography", "imageryStyle", and "overallMood", each with descriptive string values.

Here are a few examples of the desired output style for a single suggestion object, paying close attention to the 'songTitle':

--- Example 1 ---
Input Context:
Genre: Folk
Keyword/Lyric: "river bend, old memories, quiet reflection"

Desired Output Style for one suggestion object:
{
  "songTitle": "Where the River Remembers",
  "albumCoverIdeas": {
    "colorPalette": "Muted earthy tones: soft greens, river blues, and warm greys, with a hint of faded sepia.",
    "typography": "A gentle, slightly weathered serif font or a clean, classic handwritten script.",
    "imageryStyle": "A tranquil river scene at dusk or dawn, perhaps with an old wooden bridge or a solitary tree. Soft focus, evoking nostalgia.",
    "overallMood": "Reflective, peaceful, nostalgic, heartfelt"
  }
}
--- End Example 1 ---

--- Example 2 ---
Input Context:
Genre: Pop
Keyword/Lyric: "city pulse, late night, searching for connection"

Desired Output Style for one suggestion object:
{
  "songTitle": "Streetlight Searchers",
  "albumCoverIdeas": {
    "colorPalette": "Vibrant city neons (pinks, blues, purples) against dark backgrounds, or a more intimate warm glow from a window.",
    "typography": "Modern, sleek sans-serif or a stylish, slightly edgy script.",
    "imageryStyle": "Blurred city lights, figures walking in the rain, a silhouette against a bright sign, or a close-up conveying longing.",
    "overallMood": "Yearning, hopeful, urban, contemporary"
  }
}
--- End Example 2 ---

--- Example 3 ---
Input Context:
Genre: Synthwave
Keyword/Lyric: "retro highway, 80s chrome, chasing the horizon"

Desired Output Style for one suggestion object:
{
  "songTitle": "Horizon Drive '88",
  "albumCoverIdeas": {
    "colorPalette": "Hot pinks, electric blues, deep purples, sunset oranges, with chrome and black accents.",
    "typography": "Classic 80s retro fonts, often with a metallic sheen, grid lines, or neon glow effect.",
    "imageryStyle": "A vintage sports car driving into a wireframe sunset, neon grids, palm tree silhouettes, retro-futuristic cityscapes.",
    "overallMood": "Nostalgic, energetic, cool, futuristic-retro"
  }
}
--- End Example 3 ---

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
            try {
                const suggestionsArray = JSON.parse(suggestionsJsonString);
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
    } // This is the end of the 'catch' block
}; // THIS IS THE END of exports.handler - MAKE SURE THERE ARE NO MORE BRACES AFTER THIS LINE
