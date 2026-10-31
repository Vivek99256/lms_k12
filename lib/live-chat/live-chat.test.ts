import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  INITIAL_ADMIN_GREETING,
  addMessage,
  assignAdmin,
  attachGoogleMeet,
  bookMeetingSlot,
  cancelBooking,
  checkAndExpireMissedBookings,
  closeSession,
  configureAdminSlots,
  generateGoogleMeetUrl,
  getAdminPresence,
  getAvailableSlots,
  getDefaultMeetUrl,
  getMessages,
  getOrCreateUserSession,
  listSessions,
  recordParticipantJoin,
  setDefaultMeetUrl,
  updateAdminPresence,
} from './store';

test('1. Admin Online/Offline Presence tracking', () => {
  // Test presence for institute 999 (isolated)
  const initialPresence = getAdminPresence(999);
  assert.equal(initialPresence.isOnline, false, 'Should initially be offline');

  // Admin logs in and reports available
  updateAdminPresence('admin-999', 'Admin Kalpesh', 999, 'available');
  const onlinePresence = getAdminPresence(999);
  assert.equal(onlinePresence.isOnline, true, 'Admin should now be online');
  assert.equal(onlinePresence.primaryAdmin?.adminName, 'Admin Kalpesh');

  // Admin sets status to offline
  updateAdminPresence('admin-999', 'Admin Kalpesh', 999, 'offline');
  const offlinePresence = getAdminPresence(999);
  assert.equal(offlinePresence.isOnline, false, 'Admin should now be offline');
});

test('2. Automatic Greeting: Sent exactly once by Admin when available', () => {
  // Set admin online
  updateAdminPresence('admin-101', 'Admin Sharma', 101, 'available');

  const student = {
    userId: 'student-202',
    userName: 'Riya Mehta',
    userRole: 'Student',
    subInstituteId: 101,
  };

  const { session, messages } = getOrCreateUserSession(student, '/dashboard', 'Dashboard', 'Need help with fee breakdown');
  assert.equal(session.initialGreetingSent, true, 'Greeting flag should be true');

  // Find admin greeting message
  const greetingMsg = messages.find((m) => m.senderRole === 'admin' && m.text === INITIAL_ADMIN_GREETING);
  assert.ok(greetingMsg, `Greeting "${INITIAL_ADMIN_GREETING}" must be present in transcript`);

  // Ensure no duplicate greeting is added on subsequent assign or retrieval
  assignAdmin(session.id, { adminId: 'admin-101', adminName: 'Admin Sharma' });
  const transcriptAfter = getMessages(session.id);
  const greetingCount = transcriptAfter.filter((m) => m.text === INITIAL_ADMIN_GREETING).length;
  assert.equal(greetingCount, 1, 'Initial greeting must be sent exactly once');
});

test('3. Google Meet Auto-Suggestion after message threshold', () => {
  const student = {
    userId: 'student-303',
    userName: 'Karan Patel',
    userRole: 'Student',
    subInstituteId: 102,
  };

  const { session } = getOrCreateUserSession(student, '/dashboard', 'Dashboard');

  // Exchange messages
  addMessage({
    sessionId: session.id,
    senderId: 'student-303',
    senderName: 'Karan',
    senderRole: 'user',
    text: 'Can you check my attendance for last week?',
  });

  addMessage({
    sessionId: session.id,
    senderId: 'admin-102',
    senderName: 'Admin',
    senderRole: 'admin',
    text: 'Let me look into the register for Section B.',
  });

  // 3rd message triggers threshold
  addMessage({
    sessionId: session.id,
    senderId: 'student-303',
    senderName: 'Karan',
    senderRole: 'user',
    text: 'There was a medical leave submitted on Tuesday.',
  });

  const updatedMessages = getMessages(session.id);
  const suggestion = updatedMessages.find((m) => m.type === 'meet_suggestion');
  assert.ok(suggestion, 'Chatbot must automatically suggest scheduling a Google Meet call after threshold');
});

test('4. Admin Slots, Double-Booking Prevention, and Confirmation', () => {
  const testDate = '2026-11-01';
  configureAdminSlots(
    'admin-1',
    'Principal Kalpesh',
    1,
    testDate,
    [
      { startTime: '14:00', endTime: '14:15', durationMinutes: 15 },
      { startTime: '14:30', endTime: '14:45', durationMinutes: 15 },
    ],
    { overwrite: true }
  );

  const slots = getAvailableSlots(1, testDate);
  const targetSlot = slots.find((s) => s.startTime === '14:00');
  assert.ok(targetSlot, 'Configured slot 14:00 must be available');
  assert.equal(targetSlot.durationMinutes, 15);

  const student1 = {
    userId: 'student-A',
    userName: 'Student A',
    userRole: 'Student',
    subInstituteId: 1,
  };
  const { session } = getOrCreateUserSession(student1);

  // Student 1 books the slot
  const bookResult1 = bookMeetingSlot(targetSlot.id, session.id, student1);
  assert.equal(bookResult1.success, true, 'Student 1 should successfully book slot');
  assert.ok(bookResult1.booking?.meetUrl.startsWith('https://meet.google.com/'));
  assert.equal(bookResult1.booking?.durationMinutes, 15);

  // Student 2 tries to double-book the same slot
  const student2 = {
    userId: 'student-B',
    userName: 'Student B',
    userRole: 'Student',
    subInstituteId: 1,
  };
  const bookResult2 = bookMeetingSlot(targetSlot.id, session.id, student2);
  assert.equal(bookResult2.success, false, 'Double-booking must be blocked');
  assert.match(bookResult2.error || '', /no longer available/);
});

test('5. Automatic Expiration of Missed Meetings after 2-minute grace period', () => {
  const testDate = '2026-10-01'; // Date in the past
  configureAdminSlots(
    'admin-1',
    'Principal Kalpesh',
    1,
    testDate,
    [{ startTime: '09:00', endTime: '09:15', durationMinutes: 15 }],
    { overwrite: true }
  );

  const slot = getAvailableSlots(1, testDate)[0];
  assert.ok(slot, 'Slot for test date must exist');
  const student = {
    userId: 'student-lazy',
    userName: 'Absent Student',
    userRole: 'Student',
    subInstituteId: 1,
  };
  const { session } = getOrCreateUserSession(student);

  const bookResult = bookMeetingSlot(slot.id, session.id, student);
  assert.equal(bookResult.success, true);
  const bookingId = bookResult.booking!.id;

  // Run expiration check (since 2026-10-01 09:00 + 2m is far in the past and student didn't join)
  const expiredList = checkAndExpireMissedBookings();
  const expiredBooking = expiredList.find((b) => b.id === bookingId);

  assert.ok(expiredBooking, 'Booking should be checked');
  assert.equal(expiredBooking.status, 'missed', 'Booking must be automatically marked as missed');

  // Verify missed notice is inserted into chat
  const messages = getMessages(session.id);
  const missedNotice = messages.find((m) => m.type === 'booking_missed');
  assert.ok(missedNotice, 'Missed notice must be posted in chat allowing re-booking');
});

test('6. Google Meet URL generator format', () => {
  const url = generateGoogleMeetUrl();
  assert.match(url, /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/);
});

test('7. Dynamic date and time slot querying and admin custom slot configuration', () => {
  const futureDate = '2026-12-15';
  // Querying any arbitrary future date should automatically ensure available default slots
  const autoSlots = getAvailableSlots(1, futureDate);
  assert.ok(autoSlots.length > 0, 'Auto-generated slots must exist for student booking');
  assert.equal(autoSlots[0].date, futureDate);

  // Admin configures custom slots for another date
  const customDate = '2026-12-16';
  configureAdminSlots(
    'admin-1',
    'Principal Kalpesh',
    1,
    customDate,
    [
      { startTime: '09:30', endTime: '09:45', durationMinutes: 15 },
      { startTime: '11:00', endTime: '11:15', durationMinutes: 15 },
    ],
    { overwrite: true }
  );

  const studentSlots = getAvailableSlots(1, customDate);
  assert.equal(studentSlots.length, 2, 'Student must receive the exact 2 configured slots');
  assert.equal(studentSlots[0].startTime, '09:30');

  // Student books the first slot
  const student = { userId: 'student-test-7', userName: 'Zara', userRole: 'Student', subInstituteId: 1 };
  const { session } = getOrCreateUserSession(student);
  const bookRes = bookMeetingSlot(studentSlots[0].id, session.id, student);
  assert.equal(bookRes.success, true);

  // Student now only sees the 1 remaining unbooked slot
  const remainingSlots = getAvailableSlots(1, customDate);
  assert.equal(remainingSlots.length, 1);
  assert.equal(remainingSlots[0].startTime, '11:00');

  // Admin queries with includeBooked: true and sees both slots
  const allAdminSlots = getAvailableSlots(1, customDate, { includeBooked: true });
  assert.equal(allAdminSlots.length, 2);
  const bookedOne = allAdminSlots.find((s) => s.startTime === '09:30');
  assert.equal(bookedOne?.isBooked, true);
});

test('8. Dynamic Admin Status Toggle (Online <-> Offline) reflected in Student Chatbot Presence', () => {
  const instituteId = 888;

  // Initially offline
  assert.equal(getAdminPresence(instituteId).isOnline, false);

  // Admin logs in and selects Online
  updateAdminPresence('admin-888', 'Kalpesh Admin', instituteId, 'available');
  assert.equal(getAdminPresence(instituteId).isOnline, true, 'Student chatbot should see Admin Online');

  // Admin toggles to Offline
  updateAdminPresence('admin-888', 'Kalpesh Admin', instituteId, 'offline');
  assert.equal(getAdminPresence(instituteId).isOnline, false, 'Student chatbot should see Admin Offline');

  // Admin toggles back to Online
  updateAdminPresence('admin-888', 'Kalpesh Admin', instituteId, 'available');
  assert.equal(getAdminPresence(instituteId).isOnline, true, 'Student chatbot should see Admin Online again');
});

test('9. Sequential bookings: User 1 books 1:00 PM, User 2 books 2:00 PM; both marked Booked and double-booking blocked', () => {
  const targetDate = '2026-11-10';
  // Admin configures 1:00 PM (13:00), 2:00 PM (14:00), and 3:00 PM (15:00)
  configureAdminSlots(
    'admin-1',
    'Principal Kalpesh',
    1,
    targetDate,
    [
      { startTime: '13:00', endTime: '13:15', durationMinutes: 15 },
      { startTime: '14:00', endTime: '14:15', durationMinutes: 15 },
      { startTime: '15:00', endTime: '15:15', durationMinutes: 15 },
    ],
    { overwrite: true }
  );

  // Initial available slots: 3
  const initialAvailable = getAvailableSlots(1, targetDate);
  assert.equal(initialAvailable.length, 3, 'All 3 slots should initially be available');

  const slot1 = initialAvailable.find((s) => s.startTime === '13:00')!;
  const slot2 = initialAvailable.find((s) => s.startTime === '14:00')!;
  const slot3 = initialAvailable.find((s) => s.startTime === '15:00')!;

  // User 1 books 1:00 PM (13:00)
  const user1 = { userId: 'user-1', userName: 'User One', userRole: 'Student', subInstituteId: 1 };
  const session1 = getOrCreateUserSession(user1);
  const bookResult1 = bookMeetingSlot(slot1.id, session1.session.id, user1);
  assert.equal(bookResult1.success, true, 'User 1 should successfully book 1:00 PM');

  // Immediately check availability: only 2 slots remain (13:00 is gone!)
  const afterUser1Slots = getAvailableSlots(1, targetDate);
  assert.equal(afterUser1Slots.length, 2, 'Only 2 slots should remain available');
  assert.equal(afterUser1Slots.some((s) => s.startTime === '13:00'), false, '1:00 PM slot must no longer be available');

  // User 2 books 2:00 PM (14:00)
  const user2 = { userId: 'user-2', userName: 'User Two', userRole: 'Student', subInstituteId: 1 };
  const session2 = getOrCreateUserSession(user2);
  const bookResult2 = bookMeetingSlot(slot2.id, session2.session.id, user2);
  assert.equal(bookResult2.success, true, 'User 2 should successfully book 2:00 PM');

  // Immediately check availability: only 1 slot remains (15:00)
  const afterUser2Slots = getAvailableSlots(1, targetDate);
  assert.equal(afterUser2Slots.length, 1, 'Only 1 slot should remain available for other users');
  assert.equal(afterUser2Slots[0].startTime, '15:00', 'Only 3:00 PM slot should remain');

  // User 3 attempts to book 1:00 PM (double booking attempt)
  const user3 = { userId: 'user-3', userName: 'User Three', userRole: 'Student', subInstituteId: 1 };
  const session3 = getOrCreateUserSession(user3);
  const doubleBookAttempt1 = bookMeetingSlot(slot1.id, session3.session.id, user3);
  assert.equal(doubleBookAttempt1.success, false, 'User 3 booking 1:00 PM must be rejected');
  assert.match(doubleBookAttempt1.error || '', /no longer available/);

  // User 3 attempts to book 2:00 PM (double booking attempt)
  const doubleBookAttempt2 = bookMeetingSlot(slot2.id, session3.session.id, user3);
  assert.equal(doubleBookAttempt2.success, false, 'User 3 booking 2:00 PM must be rejected');
  assert.match(doubleBookAttempt2.error || '', /no longer available/);

  // Verify Admin view (with includeBooked: true): shows all 3 slots, with 1:00 PM and 2:00 PM marked as Booked
  const adminSlots = getAvailableSlots(1, targetDate, { includeBooked: true });
  assert.equal(adminSlots.length, 3, 'Admin sees all 3 slots');
  assert.equal(adminSlots.find((s) => s.startTime === '13:00')?.isBooked, true, '1:00 PM is Booked');
  assert.equal(adminSlots.find((s) => s.startTime === '14:00')?.isBooked, true, '2:00 PM is Booked');
  assert.equal(adminSlots.find((s) => s.startTime === '15:00')?.isBooked, false, '3:00 PM is still Available');
});

test('10. Real-Time Chat Messaging & Two-Way Synchronized Conversation between Student and Admin', () => {
  const studentUser = {
    userId: 'student-rt-1',
    userName: 'Kavya Shah',
    userRole: 'Student',
    subInstituteId: 777,
  };

  // 1. Student opens chatbot and sends message
  const { session } = getOrCreateUserSession(studentUser, '/lms/homework/submission', 'Homework');
  const studentMsg = addMessage({
    sessionId: session.id,
    senderId: 'student-rt-1',
    senderName: 'Kavya Shah',
    senderRole: 'user',
    text: 'Hello admin, I need help with my physics homework submission.',
  });
  assert.ok(studentMsg, 'Student message must be successfully added');

  // Both sides query messages for this session
  const transcriptForAdmin = getMessages(session.id);
  const foundStudentMsg = transcriptForAdmin.find((m) => m.id === studentMsg!.id);
  assert.ok(foundStudentMsg, 'Student message must immediately appear on Admin screen');
  assert.equal(foundStudentMsg?.senderRole, 'user');

  // 2. Admin replies to student in the exact same session
  const adminMsg = addMessage({
    sessionId: session.id,
    senderId: '7013',
    senderName: 'kalpesh',
    senderRole: 'admin',
    text: 'Hello Kavya! I can see your submission draft. Please check Chapter 4.',
  });
  assert.ok(adminMsg, 'Admin message must be successfully added');

  // Student queries messages for this session
  const transcriptForStudent = getMessages(session.id);
  const foundAdminReply = transcriptForStudent.find((m) => m.id === adminMsg!.id);
  assert.ok(foundAdminReply, 'Admin reply must immediately appear on Student screen');
  assert.equal(foundAdminReply?.senderRole, 'admin');

  // Both sides must display the identical conversation history
  assert.equal(
    transcriptForAdmin.length,
    transcriptForStudent.length,
    'Both sides must display the exact same conversation history'
  );
  assert.deepEqual(
    transcriptForAdmin.map((m) => m.id),
    transcriptForStudent.map((m) => m.id)
  );
});

test('11. Admin Queue filters out admin self-sessions so only genuine student chats are queued', () => {
  const allSessions = listSessions({ subInstituteId: 1, excludeAdminRole: true });
  // All sessions in adminQueue must belong to students/parents, never an Admin role self-session
  for (const s of allSessions) {
    assert.notEqual(s.userRole, 'Admin', 'Admin self-session must not be queued');
    assert.notEqual(s.userRole, 'Administrator', 'Administrator self-session must not be queued');
    if (s.adminId) {
      assert.notEqual(
        String(s.userId),
        String(s.adminId),
        'Session where userId equals adminId must not be queued'
      );
    }
  }
});

test('Closed student sessions are excluded from the admin queue', () => {
  const { session } = getOrCreateUserSession({
    userId: 'student-closed-session',
    userName: 'Closed Session Student',
    userRole: 'Student',
    subInstituteId: 1,
  });

  addMessage({
    sessionId: session.id,
    senderId: 'student-closed-session',
    senderName: 'Closed Session Student',
    senderRole: 'user',
    text: 'This transcript should be deleted when the chat closes.',
  });
  closeSession(session.id);

  assert.deepEqual(getMessages(session.id), [], 'Closing a session must remove its entire transcript');
  assert.equal(
    addMessage({
      sessionId: session.id,
      senderId: 'student-closed-session',
      senderName: 'Closed Session Student',
      senderRole: 'user',
      text: 'Messages cannot be added after a session closes.',
    }),
    null,
    'A closed session must reject new messages'
  );
  assert.equal(
    listSessions({ subInstituteId: 1, excludeAdminRole: true }).some((queued) => queued.id === session.id),
    false,
    'Closed student sessions must not appear in the admin queue'
  );
  assert.equal(
    listSessions({ status: 'closed' }).some((closed) => closed.id === session.id),
    true,
    'Closed sessions remain available when explicitly requested'
  );
});

test('12. Authentic Google Meet room link configuration, slot assignment, and instant call', () => {
  const realMeetUrl = 'https://meet.google.com/xyz-pqrs-uvw';

  // 1. Admin configures slots with an authentic Google Meet URL
  const testDate = '2026-10-30';
  const slots = configureAdminSlots(
    'admin-real',
    'Admin Test',
    1,
    testDate,
    [{ startTime: '11:00', endTime: '11:15', durationMinutes: 15 }],
    { overwrite: true, defaultMeetUrl: realMeetUrl }
  );

  assert.equal(getDefaultMeetUrl(), realMeetUrl, 'Store should persist defaultMeetUrl');
  assert.equal(slots[0]?.meetUrl, realMeetUrl, 'Configured slot should have the authentic meetUrl');

  // 2. Student books the slot
  const student = {
    userId: 'student-meet-test',
    userName: 'Aman Verma',
    userRole: 'Student',
    subInstituteId: 1,
  };
  const { session } = getOrCreateUserSession(student, '/dashboard', 'Dashboard');
  const bookResult = bookMeetingSlot(slots[0].id, session.id, student);

  assert.equal(bookResult.success, true);
  assert.equal(bookResult.booking?.meetUrl, realMeetUrl, 'Booking must use the configured authentic Google Meet URL');

  // Confirmation card message in chat transcript must also have the authentic URL
  const messages = getMessages(session.id);
  const bookingConfirmMsg = messages.find((m) => m.type === 'booking_confirmation');
  assert.equal(bookingConfirmMsg?.meetUrl, realMeetUrl, 'Chat card must link to authentic Google Meet URL');

  // 3. Instant Google Meet call uses default URL when no custom URL given
  const meetResult = attachGoogleMeet({
    sessionId: session.id,
    senderId: 'admin-real',
    senderName: 'Admin Test',
    senderRole: 'admin',
  });
  assert.equal(meetResult?.message.meetUrl, realMeetUrl, 'Instant call must use default authentic Meet URL');

  // 4. Instant Google Meet call uses custom URL when provided
  const customMeetUrl = 'https://meet.google.com/custom-room-test';
  const customMeetResult = attachGoogleMeet({
    sessionId: session.id,
    senderId: 'admin-real',
    senderName: 'Admin Test',
    senderRole: 'admin',
    customMeetUrl,
  });
  assert.equal(customMeetResult?.message.meetUrl, customMeetUrl, 'Instant call must use provided custom URL');
});
