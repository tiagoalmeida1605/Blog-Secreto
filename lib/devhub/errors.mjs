export class DevHubError extends Error {
  constructor(status, code, message, options = {}) {
    super(message);
    this.name = "DevHubError";
    this.status = status;
    this.code = code;
    this.publicMessage = message;
    this.causeCode = options.causeCode;
  }
}
