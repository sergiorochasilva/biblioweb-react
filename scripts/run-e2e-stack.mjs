import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const API_REPO_PATH = "/home/sergio/@pessoal/biblioweb-api";
const COMPOSE_FILE = `${API_REPO_PATH}/docker-compose.yml`;
const PROJECT_NAME = process.env.E2E_COMPOSE_PROJECT || "biblioweb-e2e";
const API_BASE_URL = process.env.PLAYWRIGHT_API_BASE_URL || "http://127.0.0.1:5000";
const PLAYWRIGHT_TEST_ARGS = (process.env.PLAYWRIGHT_TEST_ARGS || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

function runCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            stdio: "inherit",
            shell: false,
            ...options,
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
    const composeEnv = {
        ...process.env,
        PLAYWRIGHT_API_BASE_URL: API_BASE_URL,
    };

    await runCommand(
        "docker",
        ["compose", "-p", PROJECT_NAME, "-f", COMPOSE_FILE, "up", "-d", "postgres", "redis", "app", "worker"],
        { env: composeEnv }
    );

    try {
        await waitForApiPing();
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
