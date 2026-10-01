import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  getCurrentModule,
  evaluateChatbotIntent,
} from './chatbot-navigation';

test('getCurrentModule resolves correct module slug and display label', () => {
  assert.deepEqual(getCurrentModule('/fees/collect'), { name: 'fees', label: 'Fees' });
  assert.deepEqual(getCurrentModule('/students/search_student'), { name: 'students', label: 'Student' });
  assert.deepEqual(getCurrentModule('/admissions/admission_enquiry'), { name: 'admissions', label: 'Admissions' });
  assert.deepEqual(getCurrentModule('/attendance/attendance_dashboard'), { name: 'attendance', label: 'Attendance' });
  assert.deepEqual(getCurrentModule('/dashboard'), { name: 'general', label: 'General' });
});

test('Scenario 1: Open Fees onboarding in Fees context returns exact Fees onboarding action', () => {
  const result = evaluateChatbotIntent('Open Fees onboarding', '/fees/onboarding');

  assert.equal(result.type, 'navigation');
  assert.equal(result.headline, 'Fees Onboarding');
  assert.equal(result.message, 'Open the Fees onboarding process.');
  assert.equal(result.route, '/fees/onboarding');
  assert.equal(result.actionLabel, 'Open Fees Onboarding');
});

test('Scenario 2: Open Student module returns Student module navigation', () => {
  const result = evaluateChatbotIntent('Open Student module', '/dashboard');

  assert.equal(result.type, 'navigation');
  assert.equal(result.headline, 'Student Module');
  assert.equal(result.message, 'Open the Student module.');
  assert.equal(result.route, '/students/search_student');
  assert.equal(result.actionLabel, 'Open Student Module');
});

test('Scenario 3: Unsupported action in Student module context returns clarification message', () => {
  const result = evaluateChatbotIntent('Open Fees onboarding', '/students/search_student');

  assert.equal(result.type, 'unsupported');
  assert.equal(
    result.message,
    'This action isn’t available from the Student module. What would you like to check in the Student module?'
  );
});

test('Scenario 4: Direct module switch from another module is allowed', () => {
  const result = evaluateChatbotIntent('Open Fees module', '/students/search_student');

  assert.equal(result.type, 'navigation');
  assert.equal(result.headline, 'Fees Module');
  assert.equal(result.route, '/fees/onboarding');
});

test('Scenario 5: Pending fees and data queries evaluate to standard to use real backend flow and DB data', () => {
  const queryResult = evaluateChatbotIntent(
    'Whose fees are pending?',
    '/fees'
  );
  assert.equal(queryResult.type, 'standard');

  const detailResult = evaluateChatbotIntent('Show the details of the first class.', '/fees');
  assert.equal(detailResult.type, 'standard');
});
