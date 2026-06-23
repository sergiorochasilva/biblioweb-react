import crypto from "node:crypto";

if (typeof crypto.hash !== "function") {
  crypto.hash = (algorithm, data, outputEncoding) => {
    const hash = crypto.createHash(algorithm);
    hash.update(Buffer.isBuffer(data) ? data : Buffer.from(data));
    return hash.digest(outputEncoding);
  };
}

await import("../node_modules/vite/bin/vite.js");
