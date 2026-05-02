// Proxies /.netlify/functions/vote-reconcile on this site to the upstream
// deploy that hosts the live back-end. Netlify reserves the /.netlify/*
// path namespace, so a [[redirects]] rule for it is silently ignored — a
// real function file is required for the path to be routed.

const UPSTREAM = "https://69f54b337755e5d176e2cef9--thenextfilmlead.netlify.app";

export default async (request) => {
  const url = new URL(request.url);
  const target = UPSTREAM + "/.netlify/functions/vote-reconcile" + url.search;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");

  const body = request.method === "GET" || request.method === "HEAD"
    ? undefined
    : await request.arrayBuffer();

  const upstreamResponse = await fetch(target, {
    method: request.method,
    headers,
    body,
    redirect: "manual",
  });

  const respHeaders = new Headers(upstreamResponse.headers);
  respHeaders.delete("content-encoding");
  respHeaders.delete("content-length");
  respHeaders.delete("transfer-encoding");

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: respHeaders,
  });
};
