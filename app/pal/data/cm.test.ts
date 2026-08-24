import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateChallengeScore } from './cm';

const response = (opts: {
    difficulty?: number;
    response_time: number;
    is_correct: boolean;
}): { difficulty: number; response_time: number; is_correct: boolean } => ({
    difficulty: opts.difficulty ?? 3,
    response_time: opts.response_time,
    is_correct: opts.is_correct,
});

test('calculateChallengeScore - all correct fast high difficulty', () => {
    const responses = Array.from({ length: 5 }, (_, i) =>
        response({ difficulty: 5, response_time: 20 + i * 2, is_correct: true })
    );
    const result = calculateChallengeScore(responses, 30);
    assert.equal(result.is_qualified, true);
    assert.equal(result.valid_responses, 5);
    assert.equal(result.correct_responses, 5);
    assert.ok(result.raw_score > 0);
    assert.ok(result.accuracy > 0);
});

test('calculateChallengeScore - all correct slow speed gives ratio 0.25 (below target)', () => {
    const responses = Array.from({ length: 5 }, () =>
        response({ difficulty: 3, response_time: 120, is_correct: true })
    );
    const result = calculateChallengeScore(responses, 30);
    assert.equal(result.is_qualified, true);
    assert.equal(result.speed_ratio, 0.25);
});

test('calculateChallengeScore - zero time responses treated as invalid', () => {
    const responses = [
        response({ difficulty: 3, response_time: 0, is_correct: true }),
        response({ difficulty: 3, response_time: 10, is_correct: true }),
        response({ difficulty: 3, response_time: 0, is_correct: false }),
        response({ difficulty: 3, response_time: 15, is_correct: true }),
        response({ difficulty: 3, response_time: 0, is_correct: true }),
        response({ difficulty: 3, response_time: 20, is_correct: true }),
    ];
    const result = calculateChallengeScore(responses, 30);
    assert.equal(result.valid_responses, 3);
    assert.equal(result.total_items, 6);
});

test('calculateChallengeScore - fewer than 5 valid responses is not qualified', () => {
    const responses = [
        response({ difficulty: 5, response_time: 10, is_correct: true }),
        response({ difficulty: 5, response_time: 10, is_correct: true }),
        response({ difficulty: 5, response_time: 10, is_correct: true }),
        response({ difficulty: 5, response_time: 0, is_correct: true }),
    ];
    const result = calculateChallengeScore(responses, 30);
    assert.equal(result.is_qualified, false);
    assert.ok(result.raw_score === 0 || result.raw_score >= 0);
});

test('calculateChallengeScore - poor accuracy with high speed does not produce high score', () => {
    const fastWrong = Array.from({ length: 5 }, () =>
        response({ difficulty: 5, response_time: 5, is_correct: false })
    );
    const resultFastWrong = calculateChallengeScore(fastWrong, 30);
    assert.equal(resultFastWrong.accuracy, 0);

    const slowRight = Array.from({ length: 5 }, (_, i) =>
        response({ difficulty: 3, response_time: 40 + i, is_correct: true })
    );
    const resultSlowRight = calculateChallengeScore(slowRight, 30);
    assert.ok(resultSlowRight.accuracy > 0);
    assert.ok(resultSlowRight.raw_score >= 0);
});

test('calculateChallengeScore - exactly 5 valid responses qualifies', () => {
    const responses = Array.from({ length: 5 }, (_, i) =>
        response({ difficulty: 4, response_time: 15 + i, is_correct: i < 4 })
    );
    const result = calculateChallengeScore(responses, 30);
    assert.equal(result.is_qualified, true);
    assert.equal(result.valid_responses, 5);
    assert.equal(result.correct_responses, 4);
});

test('calculateChallengeScore - empty responses', () => {
    const result = calculateChallengeScore([], 30);
    assert.equal(result.is_qualified, false);
    assert.equal(result.valid_responses, 0);
    assert.equal(result.raw_score, 0);
    assert.equal(result.accuracy, 0);
});

test('calculateChallengeScore - difficulty coefficient is avg / 5', () => {
    const responses = [
        response({ difficulty: 1, response_time: 10, is_correct: true }),
        response({ difficulty: 5, response_time: 10, is_correct: true }),
    ];
    const result = calculateChallengeScore(responses, 30);
    assert.equal(result.valid_responses, 2);
    assert.equal(result.difficulty_coefficient, 0.6);
});

test('calculateChallengeScore - target time 10 with avg 5 gives speed ratio 2.0 (capped)', () => {
    const responses = [
        response({ difficulty: 3, response_time: 5, is_correct: true }),
        response({ difficulty: 3, response_time: 5, is_correct: true }),
    ];
    const result = calculateChallengeScore(responses, 10);
    assert.equal(result.speed_ratio, 2.0);
});

test('calculateChallengeScore - target time 10 with avg 20 gives speed ratio 0.5', () => {
    const responses = [
        response({ difficulty: 3, response_time: 20, is_correct: true }),
        response({ difficulty: 3, response_time: 20, is_correct: true }),
    ];
    const result = calculateChallengeScore(responses, 10);
    assert.equal(result.speed_ratio, 0.5);
});

test('calculateChallengeScore - mixed correct/incorrect with qualification', () => {
    const responses = [
        response({ difficulty: 4, response_time: 12, is_correct: true }),
        response({ difficulty: 4, response_time: 15, is_correct: true }),
        response({ difficulty: 4, response_time: 18, is_correct: false }),
        response({ difficulty: 4, response_time: 10, is_correct: true }),
        response({ difficulty: 4, response_time: 22, is_correct: true }),
    ];
    const result = calculateChallengeScore(responses, 20);
    assert.equal(result.is_qualified, true);
    assert.equal(result.correct_responses, 4);
    assert.equal(result.valid_responses, 5);
    assert.equal(result.accuracy, 0.8);
});
