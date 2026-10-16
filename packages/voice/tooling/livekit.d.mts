// Types for tooling/livekit.mjs (plain ESM so it runs without the TS loader in any npm script).
export declare const LIVEKIT_VERSION: string;
export declare const SHA256: Record<string, string>;
export declare const MIN_GO: [number, number];
export declare const DOCKER_IMAGE: string;
export declare const repoRoot: string;
export declare const cacheDir: string;
export declare const binaryPath: string;
export declare function releaseAsset(platform?: string, arch?: string): string | null;
export declare function parseGoVersion(s: string): [number, number] | null;
export declare function goIsRecentEnough(v: [number, number] | null): boolean;
export declare function renderConfig(opts: { port: number; tcpPort: number; udpStart: number; udpEnd: number; apiKey: string; apiSecret: string; bind?: string }): string;
export declare function goEnv(base?: Record<string, string | undefined>): Record<string, string | undefined> & { HOME: string; GOCACHE: string; GOMODCACHE: string; GOPATH: string; GOTMPDIR: string; TMPDIR: string; XDG_CONFIG_HOME: string; XDG_CACHE_HOME: string; GOENV: string; GOTOOLCHAIN: string };
export declare function ensureLiveKit(opts?: { allowDocker?: boolean }): Promise<{ kind: 'binary'; path: string } | { kind: 'docker'; image: string }>;
export interface LiveKitHandle {
  url: string;
  wsUrl: string;
  apiKey: string;
  apiSecret: string;
  pid: number | undefined;
  kind: 'binary' | 'docker';
  stop: () => Promise<void>;
}
export declare function startLiveKit(opts?: { port?: number; tcpPort?: number; udpStart?: number; udpEnd?: number; apiKey?: string; apiSecret?: string; bind?: string; logFile?: string }): Promise<LiveKitHandle>;
