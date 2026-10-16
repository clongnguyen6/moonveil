// @moonveil/voice/client — browser side. Framework-free VoiceClient; React hook in ./client/react.ts
// (import '@moonveil/voice/client/react' only from React code: react is an optional peer dependency).
export type { VoiceSession } from './server/types.ts';
export { EV, VoiceClient, type ChannelState, type ChannelView, type MicState, type MicTrackLike, type ParticipantView, type RemoteTrackLike, type RoomLike, type VoiceClientOptions, type VoiceSnapshot } from './client/voice-client.ts';
