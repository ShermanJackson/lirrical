// File: netlify/functions/generateSongLyrics.js

exports.handler = async function(event, context) {
    console.log("--- generateSongLyrics function invoked! ---");
    console.log("Received event query parameters:", JSON.stringify(event.queryStringParameters));

    const { songTitle, genre } = event.queryStringParameters;

    if (!songTitle || !genre) {
        console.error("Missing songTitle or genre parameter for lyrics generation.");
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Missing songTitle or genre for lyrics generation." }),
            headers: { "Content-Type": "application/json" },
        };
    }

    const apiKey = process.env.GEMINI_API_KEY; // This will use the same key you set up in Netlify

    if (!apiKey) {
        console.error("GEMINI_API_KEY is not set in Netlify environment variables for generateSongLyrics.");
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "API key not configured on the server." }),
            headers: { "Content-Type": "application/json" },
        };
    }

    const promptText = `You are a creative songwriter.