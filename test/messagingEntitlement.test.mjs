import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canActivatePaidOrder,
  canBuyerSendMessage,
  computeRenewalEnd,
  evaluateMessagingEntitlement,
  formatMessagingExpiry,
  isEligibleMessagingPlan,
  isSubscriptionActive,
  nextSubscriptionActivation,
} from '../src/lib/messagingEntitlement.ts';

const NOW = new Date('2026-10-20T10:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

function sub(overrides = {}) {
  return {
    id: 'sub-1',
    promotionId: 'promo-business',
    plan: 'business',
    status: 'active',
    endsAt: new Date(NOW.getTime() + 10 * DAY).toISOString(),
    promotion: { messagingAccess: true },
    ...overrides,
  };
}

test('the explicit messaging flag is the only plan criterion', () => {
  assert.equal(isEligibleMessagingPlan({ messagingAccess: true }), true);
  assert.equal(isEligibleMessagingPlan({ messagingAccess: false }), false);
  assert.equal(isEligibleMessagingPlan({}), false);
  assert.equal(isEligibleMessagingPlan(null), false);
});

test('active, unexpired eligible subscription grants access', () => {
  assert.equal(evaluateMessagingEntitlement({ subscriptions: [sub()], now: NOW }), true);
  assert.equal(evaluateMessagingEntitlement({ isAdmin: true, subscriptions: [], now: NOW }), true);
});

test('inactive and expired subscriptions do not grant access', () => {
  assert.equal(isSubscriptionActive(sub({ status: 'cancelled' }), NOW), false);
  assert.equal(
    isSubscriptionActive(sub({ endsAt: new Date(NOW.getTime() - 1).toISOString() }), NOW),
    false
  );
  assert.equal(
    evaluateMessagingEntitlement({
      subscriptions: [sub({ endsAt: new Date(NOW.getTime() - DAY).toISOString() })],
      now: NOW,
    }),
    false
  );
});

test('price does not grant or remove messaging access', () => {
  assert.equal(
    evaluateMessagingEntitlement({
      subscriptions: [sub({ promotion: { messagingAccess: true } })],
      now: NOW,
    }),
    true
  );
  assert.equal(
    evaluateMessagingEntitlement({
      subscriptions: [sub({ promotion: { messagingAccess: false } })],
      now: NOW,
    }),
    false
  );
});

test('a future subscription does not grant early access', () => {
  assert.equal(
    isSubscriptionActive(
      sub({ startsAt: new Date(NOW.getTime() + DAY).toISOString() }),
      NOW
    ),
    false
  );
});

test('legacy business subscriptions without a promotion still count', () => {
  assert.equal(
    evaluateMessagingEntitlement({
      subscriptions: [{ ...sub(), promotionId: null, plan: 'business', promotion: null }],
      now: NOW,
    }),
    true
  );
  assert.equal(
    evaluateMessagingEntitlement({
      subscriptions: [{ ...sub(), promotionId: null, plan: 'free', promotion: null }],
      now: NOW,
    }),
    false
  );
});

test('renewal extends from the later of current expiry and now', () => {
  const current = new Date(NOW.getTime() + 10 * DAY).toISOString();
  assert.equal(
    computeRenewalEnd(current, 30, NOW),
    new Date(NOW.getTime() + 40 * DAY).toISOString()
  );
  assert.equal(
    computeRenewalEnd(new Date(NOW.getTime() - 5 * DAY).toISOString(), 30, NOW),
    new Date(NOW.getTime() + 30 * DAY).toISOString()
  );
  assert.equal(
    computeRenewalEnd(null, 7, NOW),
    new Date(NOW.getTime() + 7 * DAY).toISOString()
  );
});

test('duplicate activation extends the existing row instead of adding another', () => {
  const next = nextSubscriptionActivation({
    subscriptions: [sub()],
    promotionId: 'promo-business',
    durationDays: 30,
    orderId: 'order-2',
    now: NOW,
  });
  assert.equal(next.action, 'extend');
  assert.equal(next.endsAt, new Date(NOW.getTime() + 40 * DAY).toISOString());
  assert.equal(next.orderId, 'order-2');

  const fresh = nextSubscriptionActivation({
    subscriptions: [sub({ status: 'expired' })],
    promotionId: 'promo-business',
    durationDays: 30,
    orderId: 'order-3',
    now: NOW,
  });
  assert.equal(fresh.action, 'insert');
});

test('paid or failed orders cannot be activated again', () => {
  assert.equal(canActivatePaidOrder('created'), true);
  assert.equal(canActivatePaidOrder('pending'), true);
  assert.equal(canActivatePaidOrder('paid'), false);
  assert.equal(canActivatePaidOrder('failed'), false);
});

test('sellers can reply without a plan; buyers need active access', () => {
  assert.equal(canBuyerSendMessage(null, 'seller'), true);
  assert.equal(canBuyerSendMessage(null, 'buyer'), false);
  assert.equal(canBuyerSendMessage({ allowed: true }, 'buyer'), true);
});

test('expiry is formatted for display', () => {
  assert.equal(formatMessagingExpiry('2026-11-12T00:00:00.000Z'), '12 Nov 2026');
  assert.equal(formatMessagingExpiry(null), null);
  assert.equal(formatMessagingExpiry('not-a-date'), null);
});
