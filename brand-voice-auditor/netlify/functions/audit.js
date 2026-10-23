exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "API key not configured." }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body." }) };
  }

  const { voice, copy } = body;
  if (!voice || !copy) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing voice or copy field." }) };
  }

  const prompt = `You are a senior brand voice editor. Audit the provided copy sample against the brand voice guidelines.

Brand voice:
${voice}

Copy to audit:
${copy}

Respond ONLY with a valid JSON object — no preamble, no markdown, no backticks. Use this exact structure:

{
  "scores": {
    "overall": <integer 0-100>,
    "tone": <integer 0-100>,
    "language": <integer 0-100>,
    "consistency": <integer 0-100>
  },
  "verdict": "<2-3 sentence overall assessment of how well the copy matches the brand voice>",
  "lines": [
    {
      "quote": "<short excerpt from the copy, max 15 words>",
      "status": "flag" | "suggest" | "pass",
      "feedback": "<specific, actionable feedback about this line and why it does or doesn't fit the brand voice>"
    }
  ]
}

Include 4-7 line items covering a mix of flags (doesn't fit), suggestions (could be improved), and passes (works well). Be specific and useful. Quote real fragments from the copy.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: data.error?.message || "Anthropic API error." }),
      };
    }

    const raw = (data.content || []).find((b) => b.type === "text")?.text || "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const result = JSON.parse(clean);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Something went wrong. Please try again." }),
    };
  }
};
