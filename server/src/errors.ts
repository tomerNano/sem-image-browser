/** An error that carries the HTTP status the API should answer with. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "HttpError";
  }
}
