# Moonveil product brief

Status: pre-implementation. Decisions approved in conversation through 2026-10-16.

## Outcome

A social Werewolf web game for colleagues, playable from home or together in person. Each player uses a phone or laptop. A typical match has 7–10 players; larger groups should be considered, with the supported maximum still to be verified.

Players talk inside Moonveil. Support both a separate human moderator and automatic game orchestration. A participating room creator must not receive moderator access to secret information.

## Approved first-version scope

- Create and join a room by link/code, choose a name and appearance, check microphone/audio, and ready up.
- One camping map beside a stream: tents, campfire, bridge, forest, and day/night atmosphere.
- 2D angled view with depth (2.5D), a fixed camera, and readable phone/laptop controls.
- Lobby: freely move around camp and use shared voice across the map.
- Active match: sit around the campfire with small movements and speaking indicators. Night uses a common transition to tents and private skill selection.
- Eliminated players become ghosts, move freely across terrain, see and talk to other ghosts, and hear public discussion. Living players cannot see ghost movements or hear ghost communication.
- Ghosts cannot inspect secret roles/actions or hear the wolf channel. Flying near a tent reveals no private activity. Reveal roles at match end.
- Complete day/night loop, voting, victory, final role reveal, and reconnect preserving identity, role, and state.
- In-game voice/text follow game permissions. Secret night movements, membership changes, speaking indicators, and actions must not expose roles or targets to unauthorized players.
- Both moderator and automatic modes are included.

## Approved rules

First version has exactly six role types: ordinary Wolf, Villager, Seer, Guard, Witch, and Hunter.

- Wolves win when living Wolves are at least as numerous as living villagers, including village-aligned special roles.
- Villagers win when no Wolves remain alive.
- Advanced roles and Blind Mode are deferred.
- Use `sky2/LUAT_CHOI_MA_SOI.md` and its implementation as reference. The approved numerical victory rule replaces the old remaining-skill-based endgame logic.

Resolve simultaneous deaths and linked effects before deciding the outcome; the exact precedence, including zero survivors, remains a rule decision to confirm rather than infer from the two victory statements.

## Approved visual and experience direction

- Inviting camping atmosphere with mystery at night: stream, tents, campfire, forest, warm light, and moonlight.
- Player appearance is independent of secret role.
- Free movement enriches the lobby and ghost experience; active play centers on conversation and deduction.
- Early visual preview for Human approval. Final acceptance also requires polished animation, transitions, audio, and UI, not merely a functional prototype.

### Revised art direction (Human, 2026-10-17; approved as direction, execution pending review)

The first preview was judged too cartoonish/childlike and visually dull for colleagues aged ~23–34. Replacement direction:
- Mature nighttime camping: warm but subtly unsettling after dark; cinematic lighting. No gore or extreme horror.
- Keep: 2D angled view; camping/stream/tents/campfire; existing gameplay, lobby and ghost semantics.
- Layered forest and stream depth, light mist; warm fire and tent lamps against dark surroundings.
- Muted palette (forest green, charcoal, amber); fewer bright colours, no excessive glow.
- Balanced adult avatar proportions, everyday trekking clothing; no chibi, oversized heads or cutesy treatment.
- Clean readable typography and layout; less rounded decorative framing and ornamental icons; conversation and player readability first.
- Ghosts: faint human silhouettes with gentle motion; mysterious, not cute.
- Landscape with convincing light and materials, not simple assembled geometric shapes.
- Procedural-only art is not required; no new paid assets or services without approval.
- Next: one representative polished scene plus representative UI (laptop/phone) for early Human review before building all assets. The earlier preview is not approved.

## Working proposals, not locked requirements

- (Superseded 2026-10-17 by the revised art direction above) Soft illustrated scenery, forest greens, warm firelight, and blue/purple moonlight.
- Small idle motions, hand raising, restrained emotes, water/fire/foliage animation, and ambience lowered during conversation.
- Keyboard controls on laptop and a virtual joystick on phone; Lead may improve these based on usability evidence.
- In-person play defaults to direct conversation with in-game voice off to avoid feedback; private wolf text at night. Physical speech cannot be controlled by the application.
- Public communication during daytime; private wolf communication at night; ghost communication separate. Permission restrictions should cover text and emotes as well as voice.
- A dedicated defense interval and optional Yes/No execution vote need a final rule decision. Private direct messaging is outside the proposed first-version scope.
- LiveKit is a candidate for voice, not a selected vendor or an approved paid service. Stack, hosting, and voice deployment remain open.

## Open assumptions and rule decisions

- Exact six-role rules: self-targeting, repeated Guard targets, Witch potion timing/limits and protection interactions, Hunter trigger/target timing, and information returned by Seer.
- Wolf disagreement, abstention, ties, vote thresholds, timeouts, disconnected players, and moderator intervention powers.
- Victory evaluation timing, zero survivors, and simultaneous deaths.
- Role distributions for 7–10 players and larger groups; minimum/maximum supported players and match duration.
- Whether eliminated players retain any knowledge they legitimately held before death needs no new reveal; reconnect must not grant additional secrets.
- Exact automated narration, audio defaults, browser support, and recovery when microphone access fails.
- Voice provider, infrastructure, recurring cost, and deployment destination. Bring unapproved costs to Human.

Lead may investigate and propose answers. Changes to gameplay or product scope require Human decisions under the workspace protocol.

## Reference evidence and limits

- `sky2` was inspected as source, not runtime-tested in this planning conversation.
- Its rule document and implementation differ in some advanced roles and victory handling; do not copy behavior blindly.
- The supplied web-game communication document offers ideas, not a binding architecture. Verify technical claims against primary documentation when making implementation choices.

## Acceptance target

Agents demonstrate complete 7–10-player matches through multiple browser sessions, both orchestration modes, role/voice/text isolation, ghost behavior, reconnect, and phone/laptop layouts. Include polished visual/audio experience and identify the exact tested revision and remaining limitations.

Human selected browser-based agent verification, followed by Human/colleague feedback on play feel. Do not imply real-device or real-group verification from browser emulation.
