export function logRequest({ requestId, endpoint, method, status, durationMs, dependency, dependencyStatus, error = false }) {
  const entry = {
    requestId,
    endpoint,
    method,
    status,
    durationMs,
    dependency: dependency || null,
    dependencyStatus: dependencyStatus || null,
    error
  };
  console.log(JSON.stringify(entry));
}
