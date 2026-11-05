#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = {
    console,
    BRAIN: {
        thisState: 0,
        workerReady: true,
        workerFiredNeurons: 42,
        postSynaptic: {},
        drives: {hunger: 0.2, fear: 0.1, fatigue: 0.1, curiosity: 0.5, groom: 0.1},
        stimulate: {},
    },
    behavior: {current: 'idle'},
    document: {getElementById: () => null},
};
context.window = {
    behavior: context.behavior,
    setInterval,
    clearInterval,
};

vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'judgments.js'), 'utf8'), context);
const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'frogcourt.js'), 'utf8');
vm.runInContext(source, context, {filename: 'frogcourt.js'});

const court = context.window.FrogCourt;
assert.ok(court, 'FrogCourt API should be exported');

const caseText = 'Asmo stands accused of aggravated interpretation.';
const first = court.buildStimulus(caseText);
const second = court.buildStimulus(caseText);
assert.deepEqual(first, second, 'case encoding should be stable');
assert.equal(first.nociception, true, 'aggravated case should trigger nociception');
assert.notEqual(
    court.buildStimulus('The frog requests a library card.').caseHash,
    first.caseHash,
    'different cases should receive different encodings',
);

const reading = {
    firedNeurons: 42,
    neural: {
        MB_MBON_APP: 0,
        MB_MBON_AV: 2,
        LH_APP: 0,
        LH_AV: 4,
        DN_STARTLE: 10,
        DN_FLIGHT: 1,
        DN_WALK: 0,
        SEZ_GROOM: 0,
    },
    drives: {fear: 0.8, curiosity: 0.1, groom: 0.1, fatigue: 0.1},
};
const ruling = court.interpret(first, reading);
assert.equal(ruling.verdict, 'RIBBITABLY LIABLE');
assert.match(ruling.opinion, /^CROAK\./);
assert.match(ruling.sentence, /^ORDER:/);
assert.ok(ruling.scores.aversion > ruling.scores.approach);

console.log('Frog Court core tests passed');

assert.deepEqual(court.interpret(first, reading), ruling, 'identical case/state must replay exactly');
assert.equal(ruling.selection.profile, 'escape');
assert.equal(court.interpret(first, {...reading, drives: {...reading.drives, fatigue: 0.9}}).selection.profile, 'fatigue');
assert.equal(court.interpret(first, {...reading, drives: {...reading.drives, groom: 0.9}}).selection.profile, 'grooming');
const calm = {...reading, neural: Object.fromEntries(Object.keys(reading.neural).map(k => [k, 0])), drives: {fear: 0, curiosity: 0, groom: 0, fatigue: 0}};
assert.equal(court.interpret(first, calm).selection.profile, 'ordinary');
const curious = {...calm, drives: {...calm.drives, curiosity: 0.8}};
assert.equal(court.interpret(first, curious).selection.profile, 'approach');
assert.equal(court.interpret(first, {...calm, drives: {...calm.drives, curiosity: 0.05}}).selection.profile, 'ordinary');
assert.match(court.interpret(first, curious).sentence, /Acquitted; no punitive sentence/);
const variants = new Set();
for (let i = 0; i < 500; i++) {
    const result = court.interpret(court.buildStimulus('Docket ' + i), reading);
    variants.add(result.opinion + result.sentence);
    assert.equal(result.verdict, ruling.verdict, 'case variation must not override neural verdict');
}
assert.ok(variants.size > 100, 'library should yield substantial variety within one neural family');
const reordered = {...reading, capturedAt: 'different', neural: Object.fromEntries(Object.entries(reading.neural).reverse())};
assert.deepEqual(court.interpret(first, reordered), ruling, 'timestamps and property order must not change selection');
console.log('Judgment replay, neural routing, acquittal and variety tests passed');

assert.equal(court.interpret(first, {...calm, drives: {...calm.drives, fear: 0.5, curiosity: 0.6}}).selection.profile, 'conflict');
