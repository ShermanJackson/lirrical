// File: netlify/functions/getLirricalIdeas.js

exports.handler = async function(event, context) {
    console.log("--- getLirricalIdeas function invoked! ---");
    console.log("Received event query string parameters for suggestions:", JSON.stringify(event.queryStringParameters));

    const { genre, keywords } = event.queryStringParameters;

    if (!genre || !keywords) {
        console.error("getLirricalIdeas: Missing genre or keywords parameter.");
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Missing genre or keywords for suggestions." }),
            headers: { "Content-Type": "application/json" },
        };
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error("getLirricalIdeas: GEMINI_API_KEY is not set in Netlify environment variables.");
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "API key not configured on the server for suggestions." }),
            headers: { "Content-Type": "application/json" },
        };
    }

    const promptText = `You are an expert creative consultant for musicians named LIRIC.
Based on the following genre and keyword/lyric, generate an array of 12 distinct song suggestions. 
Each suggestion object in the array must include:
1.  "songTitle": A unique and creative song title.
2.  "albumCoverIdeas": An object with:
    a.  "colorPalette": A descriptive color palette.
    b.  "typography": Suggested typography style.
    c.  "imageryStyle": Ideas for imagery or visual elements.
    d.  "overallMood": The overall mood or vibe the cover should convey.

Genre: <span class="math-inline">\{genre\}
