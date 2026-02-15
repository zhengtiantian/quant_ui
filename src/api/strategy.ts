export interface StrategyTaskCode {
  taskId: string;
  code: string;
  [key: string]: unknown;
}

export interface StrategyChatResponse {
  role: "assistant" | "user";
  message: string;
  strategyId?: string;
  [key: string]: unknown;
}

async function postJsonWithFallback<T>(
  paths: string[],
  payload: unknown,
  token: string | null,
): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const errors: string[] = [];
  for (const path of paths) {
    try {
      const response = await fetch(path, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        return (await response.json()) as T;
      }
      const text = await response.text();
      errors.push(`${path} -> ${response.status} ${text}`);
    } catch (err) {
      errors.push(`${path} -> ${(err as Error).message}`);
    }
  }

  throw new Error(errors.join("\n"));
}

export async function generateStrategySpec(prompt: string, userId: string) {
  return postJsonWithFallback<Record<string, unknown>>(
    ["/api/v1/strategies/generate-spec", "/api/v1/workflows/generate-spec", "/api/v1/strategy/generate-spec"],
    { prompt, userId },
    localStorage.getItem("token"),
  );
}

export async function generateStrategyTasks(strategySpec: Record<string, unknown>) {
  return postJsonWithFallback<StrategyTaskCode[] | Record<string, unknown>>(
    ["/api/v1/strategies/generate-tasks", "/api/v1/workflows/generate-tasks", "/api/v1/strategy/generate-code"],
    { strategySpec },
    localStorage.getItem("token"),
  );
}

export async function generateStrategyXml(payload: {
  strategySpec: Record<string, unknown>;
  tasks: StrategyTaskCode[] | Record<string, unknown>;
}) {
  return postJsonWithFallback<Record<string, unknown> | string>(
    [
      "/api/v1/strategies/generate-xml",
      "/api/v1/strategies/preview-xml",
      "/api/v1/workflows/generate-xml",
      "/api/v1/workflows/preview-xml",
    ],
    payload,
    localStorage.getItem("token"),
  );
}

export async function saveStrategy(payload: {
  strategySpec: Record<string, unknown>;
  tasks: StrategyTaskCode[] | Record<string, unknown>;
  xml: string;
  userId: string;
}) {
  return postJsonWithFallback<Record<string, unknown>>(
    ["/api/v1/strategies/save", "/api/v1/workflows/save", "/api/v1/strategy/finalize"],
    payload,
    localStorage.getItem("token"),
  );
}

export async function chatStrategy(payload: {
  message: string;
  userId: string;
  strategySpec?: Record<string, unknown>;
}) {
  return postJsonWithFallback<StrategyChatResponse>(
    ["/api/v1/strategies/chat", "/api/v1/workflows/chat", "/api/ai/chat"],
    payload,
    localStorage.getItem("token"),
  );
}
