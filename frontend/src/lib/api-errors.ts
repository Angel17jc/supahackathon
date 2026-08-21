export async function getApiErrorMessage(response: Response, fallbackMessage: string): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "message" in body && typeof body.message === "string") {
      return body.message;
    }
  } catch {
    // A non-JSON error response should not hide the safe client fallback.
  }

  return fallbackMessage;
}
