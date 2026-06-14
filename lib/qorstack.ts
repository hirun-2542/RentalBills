type RenderResponse = {
  url?: string;
  fileUrl?: string;
};

function getQorstackConfig() {
  const apiUrl = process.env.QORSTACK_API_URL?.replace(/\/$/, "");

  if (!apiUrl) {
    throw new Error("QORSTACK_API_URL is not configured");
  }

  return {
    apiUrl,
    apiKey: process.env.QORSTACK_API_KEY,
  };
}

async function readError(response: Response) {
  const body = await response.text().catch(() => "");
  return body || response.statusText || "qorstack render failed";
}

export async function renderBillPdf(
  variables: Record<string, string>
): Promise<string> {
  const { apiUrl, apiKey } = getQorstackConfig();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(`${apiUrl}/api/v1/render`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      templateName: "bill",
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  const data = (await response.json()) as RenderResponse;
  const fileUrl = data.url ?? data.fileUrl;

  if (!fileUrl) {
    throw new Error("qorstack response did not include a PDF URL");
  }

  return fileUrl;
}
