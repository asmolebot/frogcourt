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
