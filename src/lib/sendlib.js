const sendlibApiUrl = "https://sendlib.samueltuoyo.com/api/send";

function getSendlibConfig() {
  const apiKey = process.env.SENDLIB_API_KEY;
  const from = process.env.SENDLIB_FROM_EMAIL;

  if (!apiKey || !from) {
    throw new Error("SENDLIB_API_KEY and SENDLIB_FROM_EMAIL must be configured.");
  }

  return { apiKey, from };
}

export async function sendTransactionalEmail({ to, subject, html, text }) {
  const { apiKey, from } = getSendlibConfig();
  let response;

  try {
    response = await fetch(sendlibApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html, text }),
    });
  } catch {
    throw new Error("Unable to reach Sendlib.");
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.message || body?.error || "Sendlib email request failed.");
  }

  return body;
}
