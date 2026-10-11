/// <reference types="node" />
/**
 * For the opt-in live tests: fetch over Node's http (React Native's fetch is not there
 * under Jest) and the SIMULATED SMS code from the development server's console log.
 * Only for a throwaway server (`manage.py testserver`) and designated synthetic numbers.
 */
import { readFileSync } from "fs";
import http from "http";

export function nodeFetch(
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const req = http.request(
      {
        hostname: target.hostname,
        port: target.port,
        path: target.pathname,
        method: init.method,
        headers: init.body
          ? { ...init.headers, "Content-Length": String(Buffer.byteLength(init.body)) }
          : init.headers,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          const status = res.statusCode ?? 0;
          resolve({
            ok: status >= 200 && status < 300,
            status,
            json: async () => (data ? JSON.parse(data) : null),
          });
        });
      },
    );
    req.on("error", reject);
    if (init.body) req.write(init.body);
    req.end();
  });
}

export function simulatedCode(smsLog: string, suffix: string): string {
  const lines = readFileSync(smsLog, "utf8")
    .split("\n")
    .filter((l) => l.includes("SIMULATED SMS") && l.includes(`*** ${suffix}`));
  return lines[lines.length - 1]?.split(": ").pop()?.trim() ?? "";
}
