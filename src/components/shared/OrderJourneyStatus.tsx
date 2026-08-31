import React from 'react';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import type { OrderJourney } from './orderJourneyDomain';
import { JOURNEY_TONE_CLASS, hasJourney, journeyTone, stageDateline } from './orderJourneyDomain';

export interface OrderJourneyStatusProps {
  journey?: OrderJourney | null;
  /**
   * `full` is the detail surfaces: the stage as a line of its own, its
   * supporting sentence, its dateline, and whatever the surface hangs under it.
   * `inline` is the history list, where a row has space for the stage and
   * nothing else.
   */
  variant?: 'full' | 'inline';
  /** Payment controls, so they read as what follows from the stage. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * Where an order stands, in the words the worker derived for it.
 *
 * This is deliberately not a progress tracker. Seven labelled steps with the
 * customer's dot somewhere along them would be an e commerce funnel drawn on a
 * tea house, and it would also be a lie: an order carries one stage and the
 * date it began, not a history, so every earlier step in such a tracker would
 * be an inference and every later one a promise. What the order actually knows
 * is where it is now and when it got there, so that is what it says.
 *
 * The stage sits at display size because it is the sentence the customer came
 * to read, and the payment controls sit inside the block rather than beside it,
 * so someone waiting to pay finds the way to pay directly under the line that
 * told them.
 */
export const OrderJourneyStatus: React.FC<OrderJourneyStatusProps> = ({
  journey,
  variant = 'full',
  children,
  className,
}) => {
  const known = hasJourney(journey);

  if (variant === 'inline') {
    // Nothing at all rather than a placeholder word: a row that has lost its
    // stage should read as a row without one, never as a stage nobody set.
    if (!known) return null;
    return (
      <span
        data-testid="order-journey-inline"
        className={`text-ui-11 uppercase tracking-[0.1em] ${JOURNEY_TONE_CLASS[journeyTone(journey.stage)]} ${className || ''}`.trim()}
      >
        {journey.label}
      </span>
    );
  }

  const dateline = stageDateline(journey);

  // The block still renders when the stage is unknown, because the payment
  // controls it carries are gated on the balance and not on the stage.
  if (!known && !children) return null;

  return (
    <div data-testid="order-journey" className={`space-y-4 ${className || ''}`.trim()}>
      {known && (
        <div className="space-y-1.5">
          <p data-testid="order-journey-label" className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>
            {journey.label}
          </p>
          {journey.detail && (
            <p data-testid="order-journey-detail" className="text-ui-13 text-tea-text-sec leading-relaxed max-w-[54ch]">
              {journey.detail}
            </p>
          )}
          {dateline && (
            <p className="text-ui-12 text-tea-text-dim">
              <time dateTime={journey.at ?? undefined} data-testid="order-journey-date">
                {dateline}
              </time>
            </p>
          )}
        </div>
      )}
      {children}
    </div>
  );
};

export default OrderJourneyStatus;
