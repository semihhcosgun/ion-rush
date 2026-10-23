import type {Race} from './game';
/** Momentum charges the next turbo from actual clean obstacle passes. */
export const RUNNER=Object.freeze({tier:2,perPass:1,flashDuration:.65});
export function runnerEnabled(r:Race){return r.bikeTier===RUNNER.tier&&!r.training&&!r.ship.active&&!r.riftTransit&&!r.failed;}
