// File: netlify/functions/generateSongLyrics.js

exports.handler = async function(event, context) {
    console.log("--- generateSongLyrics function invoked! ---");
    console.log("Received event query parameters for lyrics:", JSON.stringify(event.queryStringParameters));

    const { songTitle, genre } = event.queryStringParameters;

    if (!songTitle || !genre) {
        console.error("generateSongLyrics: Missing songTitle or genre parameter.");
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Missing songTitle or genre for lyrics generation." }), // Return JSON error
            headers: { "Content-Type": "application/json" },
        };
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error("generateSongLyrics: GEMINI_API_KEY is not set in Netlify environment variables.");
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "API key not configured on the server for lyrics." }), // Return JSON error
            headers: { "Content-Type": "application/json" },
        };
    }

    const promptText = `You are a creative songwriter.
Generate complete song lyrics for a song titled "${songTitle}" in the ${genre} genre.
The lyrics should have a typical song structure, for example:
- Verse 1
- Chorus
- Verse 2
- Chorus
- Bridge
- Chorus
- Outro (optional)

Ensure the lyrics are creative, fit the song title and genre, are well-structured, and appropriate.
Respond ONLY with the plain text of the lyrics. Do not include any introductory text, explanations, or markdown formatting.`;

    let chatHistory = [{ role: "user", parts: [{ text: promptText }] }];

    const geminiPayload = {
        contents: chatHistory,
        generationConfig: {
            responseMimeType: "text/plain", 
        }
    };

    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    console.log(`generateSongLyrics: Attempting to call Gemini API (URL key redacted): ${geminiApiUrl.split('key=')[0]}key=REDACTED`);

    try {
        const geminiResponse = await fetch(geminiApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload)
        });

        console.log("generateSongLyrics: Gemini API response status:", geminiResponse.status);

        const responseBodyText = await geminiResponse.text(); // Get body as text first for logging/errors

        if (!geminiResponse.ok) {
            console.error("generateSongLyrics: Gemini API Error Response (status " + geminiResponse.status + "):", responseBodyText);
            let detailMessage = responseBodyText;
            try {
                const parsedError = JSON.parse(responseBodyText); // Try to parse if it's JSON error from Google
                detailMessage = parsedError.error && parsedError.error.message ? parsedError.error.message : responseBodyText;
            } catch (e) { /* Use raw responseBodyText if not JSON */ }
            return {
                statusCode: geminiResponse.status, // Return actual status
                body: JSON.stringify({ error: `Gemini API request for lyrics failed. Details: ${detailMessage}` }), // Return JSON error
                headers: { "Content-Type": "application/json" },
            };
        }

        // Gemini, even when asked for text/plain via responseMimeType in generationConfig,
        // still wraps the response in its usual JSON structure.
        // We need to parse this JSON to extract the actual text.
        const resultJson = JSON.parse(responseBodyText);
        console.log("generateSongLyrics: Successfully received response from Gemini API.");

        if (resultJson.candidates && resultJson.candidates[0]?.content?.parts?.[0]?.text) {
            const lyricsText = resultJson.candidates[0].content.parts[0].text;
            console.log("generateSongLyrics: Generated lyrics successfully.");
            return {
                statusCode: 200,
                body: lyricsText, // Return the plain text lyrics
                headers: { "Content-Type": "text/plain; charset=utf-8" }, // Specify charset
            };
        } else {
            console.error("generateSongLyrics: Unexpected Gemini API response structure for lyrics:", JSON.stringify(resultJson, null, 2));
            return {
                statusCode: 500,
                body: JSON.stringify({ error: "AI did not return lyrics in the expected format." }), // Return JSON error
                headers: { "Content-Type": "application/json" },
            };
        }

    } catch (error) {
        console.error("generateSongLyrics: General error in function:", error.toString());
        return {
            statusCode: 500,
            body: JSON.stringify({ error: `Server error generating lyrics: ${error.message}` }), // Return JSON error
            headers: { "Content-Type": "application/json" },
        };
    }
};
