import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const API_REPO_PATH = "/home/sergio/@pessoal/biblioweb-api";
const COMPOSE_FILE = `${API_REPO_PATH}/docker-compose.yml`;
const API_ENV_FILE = `${API_REPO_PATH}/.env`;
const PROJECT_NAME = process.env.E2E_COMPOSE_PROJECT || "biblioweb-e2e";
const API_BASE_URL = process.env.PLAYWRIGHT_API_BASE_URL || "http://127.0.0.1:5000";
const APP_HOST_PORT = (() => {
    try {
        return new URL(API_BASE_URL).port || "5000";
    } catch {
        return "5000";
    }
})();
const PLAYWRIGHT_TEST_ARGS = (process.env.PLAYWRIGHT_TEST_ARGS || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
const DEFAULT_CHAT_PROVIDER = process.env.E2E_CHAT_PROVIDER || "local";
const DEFAULT_CHAT_MODEL = process.env.E2E_CHAT_MODEL || "gpt-5.4-nano";
const DEFAULT_EMBEDDING_BACKEND = process.env.E2E_EMBEDDING_BACKEND || "fake";
const DEFAULT_OPENAI_API_KEY = process.env.E2E_OPENAI_API_KEY || "";

function loadEnvFile(filePath) {
    try {
        return readFileSync(filePath, "utf8")
            .split(/\r?\n/)
            .reduce((acc, line) => {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith("#")) {
                    return acc;
                }

                const separatorIndex = trimmed.indexOf("=");
                if (separatorIndex < 0) {
                    return acc;
                }

                const key = trimmed.slice(0, separatorIndex).trim();
                let value = trimmed.slice(separatorIndex + 1).trim();
                if (
                    (value.startsWith('"') && value.endsWith('"')) ||
                    (value.startsWith("'") && value.endsWith("'"))
                ) {
                    value = value.slice(1, -1);
                }
                if (key) {
                    acc[key] = value;
                }
                return acc;
            }, {});
    } catch {
        return {};
    }
}

function runCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            stdio: ["ignore", "pipe", "pipe"],
            shell: true,
            ...options,
        });

        child.stdout?.on("data", (chunk) => {
            process.stdout.write(chunk);
        });
        child.stderr?.on("data", (chunk) => {
            process.stderr.write(chunk);
        });

        child.on("error", reject);
        child.on("exit", (code, signal) => {
            if (code === 0) {
                resolve();
                return;
            }

            reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? signal}`));
        });
    });
}

async function waitForApiPing(timeoutMs = 180_000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        try {
            const response = await fetch(`${API_BASE_URL}/ping`);
            if (response.ok) {
                return;
            }
        } catch {
            // Aguarda o stack subir.
        }
        await sleep(2_000);
    }

    throw new Error(`API não respondeu em ${API_BASE_URL}/ping dentro do tempo esperado.`);
}

async function main() {
    const apiEnv = loadEnvFile(resolve(API_ENV_FILE));
    const composeEnv = {
        ...process.env,
        ...apiEnv,
        PLAYWRIGHT_API_BASE_URL: API_BASE_URL,
        APP_HOST_PORT,
        CHAT_PROVIDER: DEFAULT_CHAT_PROVIDER,
        CHAT_MODEL: DEFAULT_CHAT_MODEL,
        EMBEDDING_BACKEND: DEFAULT_EMBEDDING_BACKEND,
        OPENAI_API_KEY: DEFAULT_OPENAI_API_KEY,
    };

    await runCommand(
        "docker",
        ["compose", "-p", PROJECT_NAME, "-f", COMPOSE_FILE, "up", "-d", "--force-recreate", "postgres", "redis", "app", "worker", "chat_worker"],
        { env: composeEnv }
    );

    try {
        await waitForApiPing();
        await sleep(90_000);
        await runCommand(
            "npm",
            ["run", "test:e2e:playwright", "--", ...PLAYWRIGHT_TEST_ARGS],
            { env: composeEnv }
        );
    } finally {
        await runCommand(
            "docker",
            ["compose", "-p", PROJECT_NAME, "-f", COMPOSE_FILE, "down", "-v", "--remove-orphans"],
            { env: composeEnv }
        ).catch(() => undefined);
    }
}

await main();
