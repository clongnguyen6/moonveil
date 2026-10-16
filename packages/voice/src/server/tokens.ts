// Token minting. The only place that touches the LiveKit API secret besides the backend client.
import { AccessToken, TokenVerifier } from 'livekit-server-sdk';
import type { RoomPermission } from './types.ts';

export interface TokenKeys {
  apiKey: string;
  apiSecret: string;
}

export interface MintInput {
  identity: string;
  room: string;
  permission: RoomPermission;
  ttlSeconds: number;
}

// Grants: join this one room, publish/subscribe per permission, data channel follows publish,
// hidden per permission, no metadata self-updates, no room listing or admin rights.
export async function mintToken(keys: TokenKeys, input: MintInput): Promise<string> {
  const at = new AccessToken(keys.apiKey, keys.apiSecret, { identity: input.identity, ttl: input.ttlSeconds });
  at.addGrant({
    room: input.room,
    roomJoin: true,
    canPublish: input.permission.canPublish,
    canSubscribe: input.permission.canSubscribe,
    canPublishData: input.permission.canPublish,
    hidden: input.permission.hidden,
    canUpdateOwnMetadata: false,
  });
  return at.toJwt();
}

// Test/diagnostic helper: verify a token with the same keys and return its video grant.
export async function readToken(keys: TokenKeys, token: string) {
  const claims = await new TokenVerifier(keys.apiKey, keys.apiSecret).verify(token);
  return { identity: claims.sub, video: claims.video, exp: claims.exp, nbf: claims.nbf };
}
