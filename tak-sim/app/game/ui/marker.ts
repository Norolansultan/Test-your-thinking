/**
 * The game chunk's marker (SPEC/29 revision (ay) rule 2, `31` P-12): a literal only the game's screen
 * carries, so the recruitment gate can find the game's code in a build without a manifest. The build
 * (`tools/deploy/game-gate.ts`, `npm run build:prod` with RECRUITMENT_GATE=1) drops the chunks that hold
 * it, and the production server refuses to serve any file that holds it while the gate is on
 * (`server/production/recruitment-gate.ts`). Only `GameApp.tsx` imports this module: nothing of the
 * study may ever contain the literal, or the gated server would refuse the study's own code
 * (`test/game-ui/isolation.spec.ts`).
 */

export const GAME_CHUNK_MARKER = "GAME-MODE-NOT-DURING-RECRUITMENT";
