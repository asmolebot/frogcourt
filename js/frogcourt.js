/* Frog Court -- an auditable interpretive layer over the FlyBrain connectome.
 *
 * The connectome does not understand law or language. Case text is reduced to a
 * stable hash, encoded as existing sensory inputs, and presented to the running
 * simulation. The court then samples neural-group activity, drives, and behavior
 * before rendering those measurements through a fixed swamp-law grammar.
 */
(function () {
    'use strict';

    var DELIBERATION_MS = 6500;
    var SAMPLE_MS = 500;
    var activeTimer = null;

    function hashText(text) {
        var hash = 2166136261;
        for (var i = 0; i < text.length; i++) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }

    function unitFromHash(hash, shift) {
        return ((hash >>> shift) & 255) / 255;
    }

    function buildStimulus(text) {
        var hash = hashText(text.trim().toLowerCase());
        return {
            caseHash: hash.toString(16).padStart(8, '0'),
            dangerOdor: unitFromHash(hash, 0) > 0.52,
            foodNearby: unitFromHash(hash, 8) > 0.38,
            foodContact: unitFromHash(hash, 16) > 0.7,
            touch: unitFromHash(hash, 24) > 0.45,
            touchLocation: ['head', 'thorax', 'abdomen', 'leg'][hash % 4],
            wind: ((hash >>> 5) & 1) === 1,
            windStrength: 0.25 + unitFromHash(hash, 11) * 0.75,
            lightLevel: 0.15 + unitFromHash(hash, 3) * 0.85,
            temperature: 0.2 + unitFromHash(hash, 13) * 0.6,
            nociception: /violence|murder|felony|forbidden|aggravated|anus|rectal|butt/i.test(text),
        };
    }

    function snapshot() {
        var groups = [
            'MB_MBON_APP', 'MB_MBON_AV', 'LH_APP', 'LH_AV',
            'DN_STARTLE', 'DN_FLIGHT', 'DN_WALK', 'SEZ_GROOM',
        ];
        var neural = {};
        for (var i = 0; i < groups.length; i++) {
            var state = BRAIN.postSynaptic && BRAIN.postSynaptic[groups[i]];
            neural[groups[i]] = state ? Number(state[BRAIN.thisState] || 0) : 0;
        }
        return {
            capturedAt: new Date().toISOString(),
            workerReady: !!BRAIN.workerReady,
            firedNeurons: Number(BRAIN.workerFiredNeurons || 0),
            behavior: (window.behavior && behavior.current) || 'unknown',
            drives: {
                hunger: Number(BRAIN.drives.hunger || 0),
                fear: Number(BRAIN.drives.fear || 0),
                fatigue: Number(BRAIN.drives.fatigue || 0),
                curiosity: Number(BRAIN.drives.curiosity || 0),
                groom: Number(BRAIN.drives.groom || 0),
            },
            neural: neural,
        };
    }

    function averageSamples(samples) {
        var result = snapshot();
        var keys = Object.keys(result.neural);
        var driveKeys = Object.keys(result.drives);
        result.firedNeurons = 0;
        for (var k = 0; k < keys.length; k++) result.neural[keys[k]] = 0;
        for (var d = 0; d < driveKeys.length; d++) result.drives[driveKeys[d]] = 0;

        for (var i = 0; i < samples.length; i++) {
            result.firedNeurons += samples[i].firedNeurons;
            result.behavior = samples[i].behavior;
            for (var n = 0; n < keys.length; n++) {
                result.neural[keys[n]] += samples[i].neural[keys[n]];
            }
            for (var j = 0; j < driveKeys.length; j++) {
                result.drives[driveKeys[j]] += samples[i].drives[driveKeys[j]];
            }
        }

        var count = Math.max(samples.length, 1);
        result.firedNeurons = Math.round(result.firedNeurons / count);
        for (var a = 0; a < keys.length; a++) result.neural[keys[a]] /= count;
        for (var b = 0; b < driveKeys.length; b++) result.drives[driveKeys[b]] /= count;
        result.sampleCount = samples.length;
        return result;
    }

    function applyStimulus(stimulus) {
        BRAIN.stimulate.dangerOdor = stimulus.dangerOdor;
        BRAIN.stimulate.foodNearby = stimulus.foodNearby;
        BRAIN.stimulate.foodContact = stimulus.foodContact;
        BRAIN.stimulate.touch = stimulus.touch;
        BRAIN.stimulate.touchLocation = stimulus.touchLocation;
        BRAIN.stimulate.wind = stimulus.wind;
        BRAIN.stimulate.windStrength = stimulus.windStrength;
        BRAIN.stimulate.lightLevel = stimulus.lightLevel;
        BRAIN.stimulate.temperature = stimulus.temperature;
        BRAIN.stimulate.nociception = stimulus.nociception;
    }

    function clearStimulus() {
        BRAIN.stimulate.dangerOdor = false;
        BRAIN.stimulate.foodNearby = false;
        BRAIN.stimulate.foodContact = false;
        BRAIN.stimulate.touch = false;
        BRAIN.stimulate.touchLocation = null;
        BRAIN.stimulate.wind = false;
        BRAIN.stimulate.windStrength = 0;
        BRAIN.stimulate.nociception = false;
        BRAIN.stimulate.lightLevel = 1;
        BRAIN.stimulate.temperature = 0.5;
    }

    function interpret(stimulus, reading) {
        var n = reading.neural;
        var d = reading.drives;
        var aversion = n.MB_MBON_AV + n.LH_AV + n.DN_STARTLE + n.DN_FLIGHT + d.fear * 12;
        var approach = n.MB_MBON_APP + n.LH_APP + n.DN_WALK + d.curiosity * 10;
        var proceduralNoise = d.groom * 3 + d.fatigue * 2;
        var margin = aversion - approach;
        var guilty = margin >= 0;
        var severity = Math.min(4, Math.max(0, Math.floor(Math.abs(margin) / 4 + proceduralNoise / 3)));
        var sentences = guilty ? [
            'a formal warning from the cattails',
            'three hours of invasive-duckweed removal',
            'seven nights of mosquito census duty',
            'remand to the dampest available log',
            'indefinite contempt until the defendant produces one respectable lily pad',
        ] : [
            'immediate release on one’s own recognizance',
            'dismissal with permission to leave the swamp',
            'acquittal and reimbursement of one fly',
            'expungement by ceremonial splash',
            'a certificate of amphibious innocence',
        ];
        var croaks = 1 + ((reading.firedNeurons + severity) % 4);
        var croakText = Array(croaks + 1).join('CROAK. ');
        var rationale = guilty
            ? 'Aversive and escape circuitry outweighed appetitive and exploratory activity.'
            : 'Appetitive and exploratory activity outweighed aversive and escape circuitry.';

        return {
            verdict: guilty ? 'RIBBITABLY LIABLE' : 'NOT RIBBITABLY LIABLE',
            opinion: croakText + rationale + ' The Court declines to pretend this constitutes human jurisprudence.',
            sentence: 'ORDER: ' + sentences[severity] + '.',
            scores: {
                aversion: Number(aversion.toFixed(3)),
                approach: Number(approach.toFixed(3)),
                margin: Number(margin.toFixed(3)),
                proceduralNoise: Number(proceduralNoise.toFixed(3)),
            },
        };
    }

    function setStatus(message) {
        document.getElementById('court-status').textContent = message;
    }

    function renderRuling(text, stimulus, before, reading, ruling) {
        document.getElementById('court-verdict').textContent = ruling.verdict;
        document.getElementById('court-opinion').textContent = ruling.opinion;
        document.getElementById('court-sentence').textContent = ruling.sentence;
        document.getElementById('court-record').textContent = JSON.stringify({
            caseText: text,
            stimulusEncoding: stimulus,
            preDeliberation: before,
            deliberationAverage: reading,
            interpretationScores: ruling.scores,
            disclaimer: 'The connectome does not understand language or law. This is an art/toy interpretation of measured simulation state.',
        }, null, 2);
        document.getElementById('court-ruling').hidden = false;
    }

    function deliberate(text) {
        if (activeTimer) return;
        var stimulus = buildStimulus(text);
        var before = snapshot();
        var samples = [];
        var submit = document.getElementById('court-submit');
        submit.disabled = true;
        applyStimulus(stimulus);
        setStatus('CROAK... evidence encoded as sensory input. The connectome is deliberating.');

        activeTimer = window.setInterval(function () {
            samples.push(snapshot());
            var elapsed = samples.length * SAMPLE_MS;
            setStatus('CROAK... deliberation ' + Math.min(100, Math.round(elapsed / DELIBERATION_MS * 100)) +
                '% · ' + (BRAIN.workerFiredNeurons || 0).toLocaleString() + ' neurons firing');
            if (elapsed >= DELIBERATION_MS) {
                window.clearInterval(activeTimer);
                activeTimer = null;
                clearStimulus();
                var reading = averageSamples(samples);
                var ruling = interpret(stimulus, reading);
                renderRuling(text, stimulus, before, reading, ruling);
                setStatus('Judgment entered into the swamp record. ' + ruling.verdict + '.');
                submit.disabled = false;
            }
        }, SAMPLE_MS);
    }

    function init() {
        var form = document.getElementById('court-form');
        var reset = document.getElementById('court-reset');
        if (!form || !reset) return;
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var text = document.getElementById('court-case').value.trim();
            if (text) deliberate(text);
        });
        reset.addEventListener('click', function () {
            if (activeTimer) {
                window.clearInterval(activeTimer);
                activeTimer = null;
            }
            clearStimulus();
            document.getElementById('court-ruling').hidden = true;
            document.getElementById('court-submit').disabled = false;
            setStatus('Docket cleared. The judiciary has returned to grooming itself.');
        });
    }

    window.FrogCourt = {
        hashText: hashText,
        buildStimulus: buildStimulus,
        snapshot: snapshot,
        interpret: interpret,
        deliberate: deliberate,
    };

    init();
}());
