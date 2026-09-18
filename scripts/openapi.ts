// Writes `openapi.json` from `src/shared/openapi.ts` and the types it names.
//
// Schemas are derived from the TypeScript types by ts-json-schema-generator, so a type change is a
// spec change with no second edit. CI regenerates and fails on a diff: the committed file is the
// published one, and it may not drift from the code.
//
//   bun run openapi            # write
//   bun run openapi --check    # exit 1 if the committed file is stale

import { createGenerator, type Schema } from "ts-json-schema-generator";
import { API, REFUSAL_RESPONSES, type Endpoint } from "../src/shared/openapi.ts";
import { API_VERSION, NDJSON } from "../src/shared/contract.ts";

const ROOT = new URL("..", import.meta.url).pathname;
const OUT = `${ROOT}openapi.json`;

const gen = createGenerator({
  path: `${ROOT}src/shared/index.ts`, tsconfig: `${ROOT}src/shared/tsconfig.json`,
  expose: "export", topRef: true, skipTypeCheck: true, encodeRefs: false,
});

/** Only the types the endpoints name, and what they reach; `#/definitions` becomes `#/components/schemas`. */
const defs: Record<string, Schema> = {};
const used = new Set<string>();
function ref(name: string): { $ref: string } {
  if (!used.has(name)) {
    used.add(name);
    let out: Schema;
    try { out = gen.createSchema(name); } catch (e) { throw new Error(`openapi: cannot derive ${name}: ${(e as Error).message}`); }
    Object.assign(defs, out.definitions);
  }
  return { $ref: `#/components/schemas/${name}` };
}
const schemaOf = (body: string | Record<string, unknown>) => (typeof body === "string" ? ref(body) : body);

const jsonContent = (schema: unknown) => ({ "application/json": { schema } });

function operation(e: Endpoint) {
  const parameters = [
    ...[...e.path.matchAll(/\{(\w+)\}/g)].map((m) => ({
      name: m[1]!, in: "path", required: true, schema: { type: m[1] === "n" ? "integer" : "string" },
    })),
    ...Object.entries(e.query ?? {}).map(([name, description]) => ({
      name, in: "query", required: false, description, schema: { type: "string" },
    })),
  ];
  if (e.stream) {
    parameters.push({
      name: "accept", in: "header", required: false,
      description: `\`${NDJSON}\` streams one JSON object per line; the last line is the response body.`,
      schema: { type: "string", enum: [NDJSON, "application/json"] },
    } as never);
  }

  let requestBody: unknown;
  if (e.request && "json" in e.request) requestBody = { required: true, content: jsonContent(ref(e.request.json)) };
  if (e.request && "multipart" in e.request) {
    const properties = Object.fromEntries(Object.entries(e.request.multipart).map(([k, v]) => [
      k, v === "file[]" ? { type: "array", items: { type: "string", format: "binary" } } : { type: "string" },
    ]));
    requestBody = { required: true, content: { "multipart/form-data": { schema: { type: "object", properties } } } };
  }
  if (e.request && "form" in e.request) {
    const properties = Object.fromEntries(Object.entries(e.request.form).map(([k, d]) => [k, { type: "string", description: d }]));
    requestBody = { required: true, content: { "application/x-www-form-urlencoded": { schema: { type: "object", properties } } } };
  }

  const responses: Record<string, unknown> = {};
  const add = (status: number, body: string | Record<string, unknown>) => {
    if (responses[status]) return;
    const content = Object.keys(body).length === 0 && typeof body !== "string" ? undefined
      : status === 200 && typeof body !== "string" && body.format === "binary" ? { "image/*": { schema: body } }
      : e.stream && status === 200 ? { ...jsonContent(schemaOf(body)), [NDJSON]: { schema: ref(e.stream) } }
      : jsonContent(schemaOf(body));
    responses[status] = { description: describe(status), ...(content ? { content } : {}) };
  };
  for (const [s, b] of Object.entries(e.responses)) add(Number(s), b);
  if (e.refuses) for (const [s, b] of REFUSAL_RESPONSES) add(s, b);
  if (e.auth === "bearer") add(401, "ErrorResponse");

  return {
    operationId: `${e.method.toLowerCase()}_${e.route}`,
    summary: e.summary,
    ...(parameters.length ? { parameters } : {}),
    ...(requestBody ? { requestBody } : {}),
    responses: Object.fromEntries(Object.entries(responses).sort(([a], [b]) => Number(a) - Number(b))),
    security: e.auth === "none" ? [] : e.auth === "optional" ? [{}, { bearer: [] }] : [{ bearer: [] }],
  };
}

const describe = (s: number) => ({
  200: "OK", 303: "Redirect to the landing page", 400: "Bad request", 401: "Unauthenticated", 402: "Payment required",
  403: "Not onboarded", 404: "Not found", 409: "Target gone", 410: "Expired", 411: "Length required",
  413: "Too large", 415: "Unsupported image", 422: "Rejected", 429: "Rate limited", 502: "Upstream failed",
})[s] ?? String(s);

const paths: Record<string, Record<string, unknown>> = {};
for (const e of API) (paths[e.path] ??= {})[e.method.toLowerCase()] = operation(e);

const components = Object.fromEntries(
  Object.keys(defs).sort().map((n) => [n, JSON.parse(JSON.stringify(defs[n]).replaceAll('"#/definitions/', '"#/components/schemas/'))]),
);

const spec = {
  openapi: "3.1.0",
  info: { title: "eait", version: API_VERSION, license: { name: "AGPL-3.0-only", identifier: "AGPL-3.0-only" } },
  servers: [{ url: "https://api.eait.fit" }],
  paths,
  components: { schemas: components, securitySchemes: { bearer: { type: "http", scheme: "bearer" } } },
};
const text = `${JSON.stringify(spec, null, 2)}\n`;

if (process.argv.includes("--check")) {
  const current = await Bun.file(OUT).text().catch(() => "");
  if (current !== text) {
    console.error("openapi.json is stale — run `bun run openapi` and commit the result");
    process.exit(1);
  }
  console.log(`openapi.json is current: ${Object.keys(paths).length} paths, ${Object.keys(defs).length} schemas`);
} else {
  await Bun.write(OUT, text);
  console.log(`wrote openapi.json: ${Object.keys(paths).length} paths, ${Object.keys(defs).length} schemas`);
}
