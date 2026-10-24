import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createPollSchema, updatePollSchema, votePollSchema } from './poll.schema';

describe('createPollSchema', () => {
  it('accepts a two-option hotel poll and strips identity fields', () => {
    const parsed = createPollSchema.parse({
      question: '  Which hotel?  ',
      options: [{ label: '  Taj  ' }, { label: 'Marriott' }],
      creatorId: '507f1f77bcf86cd799439011',
    });
    assert.equal(parsed.question, 'Which hotel?');
    assert.equal(parsed.options[0]?.label, 'Taj');
    assert.equal(parsed.voteType, 'single');
    assert.equal(parsed.anonymous, false);
    assert.equal('creatorId' in parsed, false);
  });

  it('rejects one option', () => {
    assert.equal(
      createPollSchema.safeParse({
        question: 'Where?',
        options: [{ label: 'Goa' }],
      }).success,
      false,
    );
  });

  it('rejects duplicate option labels', () => {
    assert.equal(
      createPollSchema.safeParse({
        question: 'Where?',
        options: [{ label: 'Goa' }, { label: 'goa' }],
      }).success,
      false,
    );
  });

  it('rejects maxChoices on a single-choice poll', () => {
    assert.equal(
      createPollSchema.safeParse({
        question: 'Where?',
        voteType: 'single',
        maxChoices: 2,
        options: [{ label: 'Goa' }, { label: 'Kerala' }],
      }).success,
      false,
    );
  });
});

describe('updatePollSchema', () => {
  it('rejects an empty patch', () => {
    assert.equal(updatePollSchema.safeParse({}).success, false);
  });
});

describe('votePollSchema', () => {
  it('requires at least one option id', () => {
    assert.equal(votePollSchema.safeParse({ optionIds: [] }).success, false);
  });
});
