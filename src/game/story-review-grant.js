/**
 * ストーリー確認用の一度きりの進行変更（2026-10-02 本人指定）。
 * 指定UID・現在の進行世代だけに適用する。対局数・勝数・報酬は加算しない。
 */
import { PHASE_EPOCH, PHASES, STORY_AXES } from "./phase.js";

const REVIEW_UID = "4jAiZRTJdQTtSJI39JrnpRLtSrB2";
const REVIEW_EPOCH = 1;
const REVIEW_GRANT = "story-review-phase3-20261002";

export function applyStoryReviewGrant(profile) {
  if (
    !profile ||
    profile.id !== REVIEW_UID ||
    PHASE_EPOCH !== REVIEW_EPOCH ||
    profile.storyReviewGrant === REVIEW_GRANT
  ) return profile;
  return {
    ...profile,
    phase: 3,
    phaseEpoch: PHASE_EPOCH,
    story: Object.fromEntries(PHASES.map(phase => [phase, [...STORY_AXES]])),
    storyReviewGrant: REVIEW_GRANT,
  };
}

