// File: netlify/functions/getLirricalIdeas.js (TEMPORARY TEST CODE)
exports.handler = async function(event, context) {
  console.log("--- LIRRICAL FUNCTION TEST: Invoked Successfully! ---");
  console.log("Received event for test:", JSON.stringify(event));
  
  return {
    statusCode: 418, // Using a distinct "I'm a teapot" error for this test
    body: JSON.stringify({ 
      message: "Test function for LIRRICAL was called!",
      dataReceived: event.queryStringParameters 
    }),
    headers: { "Content-Type": "application/json" },
  };
};
