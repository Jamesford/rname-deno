import * as path from "std/path/mod.ts";
import { Input } from "cliffy/prompt/mod.ts";

type RnameConfig = {
  apiKey: string;
};

const CONFIG_FILENAME = ".rname";

function getConfigPath(): string {
  const home = Deno.env.get("HOME");
  if (!home) throw new Error("Missing HOME env");
  return path.join(home, CONFIG_FILENAME);
}

async function promptForAPIKey(): Promise<string> {
  const apiKey: string = await Input.prompt({
    message: "Enter your TMDb API key (v3 auth)",
  });
  return apiKey;
}

export async function setupConfig(): Promise<RnameConfig> {
  const apiKey = await promptForAPIKey();
  const config = { apiKey };
  await writeConfig(config);
  return config;
}

let CONFIG_CACHE: RnameConfig | null = null;

export async function getConfig(): Promise<RnameConfig> {
  if (CONFIG_CACHE !== null) {
    return CONFIG_CACHE;
  }

  try {
    const data = await Deno.readTextFile(getConfigPath());
    return JSON.parse(data);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.log("Config not found, initiating setup...");
      return setupConfig();
    } else {
      throw error;
    }
  }
}

function writeConfig(config: RnameConfig): Promise<void> {
  CONFIG_CACHE = config;
  return Deno.writeTextFile(getConfigPath(), JSON.stringify(config));
}
