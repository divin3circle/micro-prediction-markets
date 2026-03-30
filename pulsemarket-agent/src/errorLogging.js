function toStringSafe(value) {
  if (value === undefined || value === null) return value;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function pickAxiosLikeDetails(err) {
  const response = err?.response;
  const request = err?.request;
  const config = err?.config;

  return {
    status: response?.status,
    statusText: response?.statusText,
    responseData: response?.data,
    method: config?.method,
    url: config?.url,
    baseURL: config?.baseURL,
    requestPath: request?.path,
    requestHost: request?.host,
    requestProtocol: request?.protocol,
  };
}

export function formatError(err, context = {}) {
  const details = pickAxiosLikeDetails(err);
  const payload = {
    context,
    name: err?.name,
    message: err?.message || String(err),
    code: err?.code,
    status: details.status,
    statusText: details.statusText,
    method: details.method,
    url: details.url,
    baseURL: details.baseURL,
    requestPath: details.requestPath,
    requestHost: details.requestHost,
    requestProtocol: details.requestProtocol,
    responseData: details.responseData,
  };

  if (process.env.LOG_ERROR_STACK === "true" && err?.stack) {
    payload.stack = err.stack;
  }

  return payload;
}

export function logError(prefix, err, context = {}) {
  const payload = formatError(err, context);
  // Keep this single-line JSON to make grepping production logs easier.
  console.error(`${prefix} ${toStringSafe(payload)}`);
}
