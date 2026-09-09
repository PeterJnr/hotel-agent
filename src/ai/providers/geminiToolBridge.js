import { aiToolDefinitions } from "../toolRegistry.js";

export function getGeminiFunctionDeclarations() {
  return aiToolDefinitions.map(({ name, description, inputSchema }) => ({
    name,
    description,
    parametersJsonSchema: inputSchema,
  }));
}

export function getGeminiTools() {
  return [{ functionDeclarations: getGeminiFunctionDeclarations() }];
}
