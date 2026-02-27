import { assertEquals } from 'jsr:@std/assert';
import { parseBoundedInt, validateOnboardingPayload } from './validation.ts';

Deno.test('parseBoundedInt clamps value within bounds', () => {
  assertEquals(parseBoundedInt(500, 50, 1, 200), 200);
  assertEquals(parseBoundedInt(-2, 50, 1, 200), 1);
  assertEquals(parseBoundedInt('42', 50, 1, 200), 42);
  assertEquals(parseBoundedInt('invalid', 50, 1, 200), 50);
});

Deno.test('validateOnboardingPayload accepts valid input', () => {
  const result = validateOnboardingPayload({
    sex: 'female',
    birthdate: '1993-06-01',
    diet_type: 'vegan',
    diet_goals: ['Lose weight'],
    outcomes: ['More energy'],
    notifications_enabled: true,
  });

  if ('error' in result) {
    throw new Error('Expected valid onboarding payload.');
  }

  assertEquals(result.value.sex, 'female');
  assertEquals(result.value.birthdate, '1993-06-01');
  assertEquals(result.value.diet_type, 'vegan');
  assertEquals(result.value.notifications_enabled, true);
});

Deno.test('validateOnboardingPayload rejects invalid birthdate format', () => {
  const result = validateOnboardingPayload({
    sex: 'male',
    birthdate: '06/01/1993',
    diet_type: 'classic',
  });

  if (!('error' in result)) {
    throw new Error('Expected invalid onboarding payload.');
  }

  assertEquals(result.error.status, 400);
});
