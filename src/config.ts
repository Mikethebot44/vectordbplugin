import * as fs from 'fs';
import * as path from 'path';
import { EmbeddingProvider, ProviderConfig, SemanticSearchConfig } from './index';

/**
 * Configuration file structure
 */
export interface ConfigFile {
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey?: string;
  };
  aiProvider: {
    primary: {
      provider: EmbeddingProvider;
      apiKey: string;
      model?: string;
    };
    fallbacks?: Array<{
      provider: EmbeddingProvider;
      apiKey: string;
      model?: string;
    }>;
    enableFallback?: boolean;
  };
  search?: {
    defaultTopK?: number;
    defaultThreshold?: number;
    hybridSearch?: {
      alpha?: number;
      beta?: number;
      normalization?: 'min-max' | 'z-score' | 'none';
    };
  };
}

/**
 * Environment variable configuration
 */
export interface EnvConfig {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  
  // Primary AI provider
  AI_PROVIDER?: EmbeddingProvider;
  AI_MODEL?: string;
  
  // Provider-specific API keys
  OPENAI_API_KEY?: string;
  COHERE_API_KEY?: string;
  VOYAGE_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  
  // Fallback configuration
  ENABLE_FALLBACK?: string;
  FALLBACK_PROVIDERS?: string; // JSON string array
}

/**
 * Load configuration from various sources (file, env, defaults)
 */
export class ConfigLoader {
  private configPaths = [
    'supabase-semantic-search.config.json',
    '.supabase-semantic-search.json',
    'semantic-search.config.json'
  ];

  /**
   * Load configuration from file, environment, or defaults
   */
  async loadConfig(configPath?: string): Promise<SemanticSearchConfig> {
    // Try to load from specified file path
    if (configPath) {
      return this.loadFromFile(configPath);
    }

    // Try to load from standard config files
    for (const path of this.configPaths) {
      if (fs.existsSync(path)) {
        return this.loadFromFile(path);
      }
    }

    // Fall back to environment variables
    return this.loadFromEnvironment();
  }

  /**
   * Load configuration from JSON file
   */
  private loadFromFile(filePath: string): SemanticSearchConfig {
    try {
      const configData = JSON.parse(fs.readFileSync(filePath, 'utf8')) as ConfigFile;
      return this.convertConfigFile(configData);
    } catch (error) {
      throw new Error(`Failed to load config from ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load configuration from environment variables
   */
  private loadFromEnvironment(): SemanticSearchConfig {
    const env = process.env as EnvConfig;

    // Validate required environment variables
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      throw new Error('Missing required environment variables: SUPABASE_URL, SUPABASE_ANON_KEY');
    }

    // Determine AI provider and API key
    const provider = env.AI_PROVIDER || 'openai';
    let apiKey: string;

    switch (provider) {
      case 'openai':
        if (!env.OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');
        apiKey = env.OPENAI_API_KEY;
        break;
      case 'cohere':
        if (!env.COHERE_API_KEY) throw new Error('Missing COHERE_API_KEY');
        apiKey = env.COHERE_API_KEY;
        break;
      case 'voyage':
        if (!env.VOYAGE_API_KEY) throw new Error('Missing VOYAGE_API_KEY');
        apiKey = env.VOYAGE_API_KEY;
        break;
      case 'anthropic':
        if (!env.ANTHROPIC_API_KEY) throw new Error('Missing ANTHROPIC_API_KEY');
        apiKey = env.ANTHROPIC_API_KEY;
        break;
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }

    const config: SemanticSearchConfig = {
      supabaseUrl: env.SUPABASE_URL,
      supabaseKey: env.SUPABASE_ANON_KEY,
      aiProvider: {
        provider,
        apiKey,
        model: env.AI_MODEL
      },
      enableFallback: env.ENABLE_FALLBACK === 'true'
    };

    // Parse fallback providers if specified
    if (env.FALLBACK_PROVIDERS) {
      try {
        const fallbackConfigs = JSON.parse(env.FALLBACK_PROVIDERS) as Array<{
          provider: EmbeddingProvider;
          model?: string;
        }>;

        config.fallbackProviders = fallbackConfigs.map(fallback => {
          let fallbackApiKey: string;
          
          switch (fallback.provider) {
            case 'openai':
              if (!env.OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY for fallback');
              fallbackApiKey = env.OPENAI_API_KEY;
              break;
            case 'cohere':
              if (!env.COHERE_API_KEY) throw new Error('Missing COHERE_API_KEY for fallback');
              fallbackApiKey = env.COHERE_API_KEY;
              break;
            case 'voyage':
              if (!env.VOYAGE_API_KEY) throw new Error('Missing VOYAGE_API_KEY for fallback');
              fallbackApiKey = env.VOYAGE_API_KEY;
              break;
            case 'anthropic':
              if (!env.ANTHROPIC_API_KEY) throw new Error('Missing ANTHROPIC_API_KEY for fallback');
              fallbackApiKey = env.ANTHROPIC_API_KEY;
              break;
            default:
              throw new Error(`Unsupported fallback provider: ${fallback.provider}`);
          }

          return {
            provider: fallback.provider,
            apiKey: fallbackApiKey,
            model: fallback.model
          };
        });
      } catch (error) {
        console.warn('Failed to parse FALLBACK_PROVIDERS:', error);
      }
    }

    return config;
  }

  /**
   * Convert ConfigFile format to SemanticSearchConfig
   */
  private convertConfigFile(configFile: ConfigFile): SemanticSearchConfig {
    const config: SemanticSearchConfig = {
      supabaseUrl: configFile.supabase.url,
      supabaseKey: configFile.supabase.anonKey,
      aiProvider: {
        provider: configFile.aiProvider.primary.provider,
        apiKey: configFile.aiProvider.primary.apiKey,
        model: configFile.aiProvider.primary.model
      },
      enableFallback: configFile.aiProvider.enableFallback
    };

    if (configFile.aiProvider.fallbacks) {
      config.fallbackProviders = configFile.aiProvider.fallbacks;
    }

    return config;
  }

  /**
   * Generate a sample configuration file
   */
  generateSampleConfig(): ConfigFile {
    return {
      supabase: {
        url: "https://your-project.supabase.co",
        anonKey: "your-anon-key"
      },
      aiProvider: {
        primary: {
          provider: "openai",
          apiKey: "sk-your-openai-key",
          model: "text-embedding-3-small"
        },
        fallbacks: [
          {
            provider: "cohere",
            apiKey: "your-cohere-key",
            model: "embed-english-v3.0"
          }
        ],
        enableFallback: true
      },
      search: {
        defaultTopK: 5,
        defaultThreshold: 0.7,
        hybridSearch: {
          alpha: 0.3,
          beta: 0.7,
          normalization: "min-max"
        }
      }
    };
  }

  /**
   * Generate environment variable template
   */
  generateEnvTemplate(): string {
    return `# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI Provider Configuration
AI_PROVIDER=openai
AI_MODEL=text-embedding-3-small

# Provider API Keys
OPENAI_API_KEY=sk-your-openai-key
COHERE_API_KEY=your-cohere-key
VOYAGE_API_KEY=your-voyage-key
# ANTHROPIC_API_KEY=your-anthropic-key  # Coming soon

# Fallback Configuration
ENABLE_FALLBACK=true
FALLBACK_PROVIDERS=[{"provider": "cohere", "model": "embed-english-v3.0"}]

# Usage Examples:
# For OpenAI with Cohere fallback:
# AI_PROVIDER=openai
# OPENAI_API_KEY=sk-...
# COHERE_API_KEY=co-...
# ENABLE_FALLBACK=true
# FALLBACK_PROVIDERS=[{"provider": "cohere"}]

# For Cohere primary with OpenAI fallback:
# AI_PROVIDER=cohere
# COHERE_API_KEY=co-...
# OPENAI_API_KEY=sk-...
# ENABLE_FALLBACK=true
# FALLBACK_PROVIDERS=[{"provider": "openai"}]`;
  }

  /**
   * Save configuration to file
   */
  saveConfig(config: ConfigFile, filePath: string = 'supabase-semantic-search.config.json'): void {
    try {
      fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
    } catch (error) {
      throw new Error(`Failed to save config to ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Global config loader instance
 */
export const configLoader = new ConfigLoader();

/**
 * Convenience function to load configuration
 */
export async function loadConfig(configPath?: string): Promise<SemanticSearchConfig> {
  return configLoader.loadConfig(configPath);
}